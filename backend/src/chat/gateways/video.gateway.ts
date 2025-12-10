// import { UseGuards } from '@nestjs/common';
// import {
//   ConnectedSocket,
//   MessageBody,
//   OnGatewayConnection,
//   OnGatewayDisconnect,
//   SubscribeMessage,
//   WebSocketGateway,
//   WebSocketServer,
//   WsException,
// } from '@nestjs/websockets';
// import { Server, Socket } from 'socket.io';
// import { JwtWsGuard } from 'src/auth/guard/jwtWsStrategy';
// import { ChatService } from '../chat.service';
// import { AuthenticatedSocket } from '../dtos/chat.dto';

// @WebSocketGateway({
//   cors: {
//     origin: 'http://localhost:3001',
//   },
// })
// @UseGuards(JwtWsGuard)
// export class WebRtcGateway implements OnGatewayConnection, OnGatewayDisconnect {
//   constructor(private chatService: ChatService) {}
//   @WebSocketServer()
//   server: Server;

//   handleConnection(client: Socket) {
//     // console.log(`Client connected for RTC : ${client.id}`);
//   }

//   handleDisconnect(client: Socket) {
//     // console.log(`Client disconnected for RTC: ${client.id}`);
//   }

//   @SubscribeMessage('join-video-room')
//   async handleJoinRoom(
//     @MessageBody() roomId: string,
//     @ConnectedSocket() client: AuthenticatedSocket,
//   ) {
//     console.log('=== JOIN VIDEO ROOM ===');
//     console.log('RoomId received:', roomId);
//     console.log('Client ID:', client.id);
//     console.log('Client data:', client.data);
//     console.log('User from client:', client.data.user);

//     const currentUserId = client.data.user?.id;
//     const username = client.data.user?.email;

//     console.log('Extracted userId:', currentUserId);
//     console.log('Extracted username:', username);

//     if (!currentUserId) {
//       console.warn(`Client ${client.id} tried to join without username`);
//       client.emit('error', { message: 'User not authenticated' });
//       return;
//     }

//     const room = await this.chatService.checkRoomId(roomId);
//     if (!room) {
//       console.error('Room not found:', roomId);
//       throw new WsException('Room Id doesnt exist for ' + roomId);
//     }

//     console.log('Room found:', room);
//     console.log('Room members:', room.members);

//     const chatPartner = room.members.find(
//       (memberId) => memberId !== currentUserId,
//     );

//     console.log('Chat partner:', chatPartner);

//     await client.join(roomId);

//     console.log(`User ${currentUserId} (${client.id}) joined room ${roomId}`);

//     client.emit('chatting-partner', { chatPartner, currentUserId, username });
//     console.log('Emitted chatting-partner event');
//   }

//   @SubscribeMessage('leave-video-room')
//   async handleLeaveRoom(
//     @MessageBody() data: { roomId: string },
//     @ConnectedSocket() client: AuthenticatedSocket,
//   ) {
//     const { roomId } = data;

//     const roomExists = await this.chatService.checkRoomId(roomId);
//     if (!roomExists) throw new WsException('Room Id doesnt exist for' + roomId);

//     await client.leave(roomId);

//     console.log(
//       `User ${client.data.user?.id} (${client.id}) left room ${roomId}`,
//     );
//   }

//   @SubscribeMessage('offer')
//   handleOffer(
//     @MessageBody()
//     data: {
//       roomId: string;
//       offer: RTCSessionDescriptionInit;
//     },
//     @ConnectedSocket() client: AuthenticatedSocket,
//   ) {
//     console.log(
//       `Offer received from ${client.data.user?.id} in room ${data.roomId}`,
//     );

//     // Broadcast to everyone in the room except the sender
//     client.to(data.roomId).emit('offer', {
//       from: client.data.user?.id,
//       offer: data.offer,
//     });

//     console.log(`Offer broadcasted to room ${data.roomId}`);
//   }

//   @SubscribeMessage('answer')
//   handleAnswer(
//     @MessageBody()
//     data: {
//       roomId: string;
//       answer: RTCSessionDescriptionInit;
//     },
//     @ConnectedSocket() client: AuthenticatedSocket,
//   ) {
//     console.log(
//       `Answer received from ${client.data.user?.id} in room ${data.roomId}`,
//     );

//     client.to(data.roomId).emit('answer', {
//       from: client.data.user?.id,
//       answer: data.answer,
//     });

//     console.log(`Answer broadcasted to room ${data.roomId}`);
//   }

//   @SubscribeMessage('ice-candidate')
//   handleIceCandidate(
//     @MessageBody() data: { roomId: string; candidate: RTCIceCandidateInit },
//     @ConnectedSocket() client: AuthenticatedSocket,
//   ) {
//     console.log(`ICE candidate from ${client.id} in room ${data.roomId}`);

//     client.to(data.roomId).emit('ice-candidate', {
//       sender: client.data.user?.id,
//       candidate: data.candidate,
//     });
//   }
// }
import { UseGuards } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtWsGuard } from 'src/auth/guard/jwtWsStrategy';
import { ChatService } from '../chat.service';
import { AuthenticatedSocket } from '../dtos/chat.dto';

@WebSocketGateway({
  cors: {
    origin: [
      process.env.FRONTEND_URL,
      'https://socket-6bbczzs2g-bishes-maharjans-projects.vercel.app/',
      process.env.NODE_ENV === 'production'
        ? process.env.FRONTEND_URL
        : 'http://localhost:3000',
    ],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
@UseGuards(JwtWsGuard)
export class WebRtcGateway implements OnGatewayConnection, OnGatewayDisconnect {
  // Track video room participants: roomId -> Set of user IDs
  private videoRooms = new Map<string, Set<string>>();
  // Track socket to user mapping: socketId -> userId
  private socketToUser = new Map<string, string>();
  // Track user to socket mapping: userId -> socketId (for video calls)
  private userToVideoSocket = new Map<string, string>();

  constructor(private chatService: ChatService) {}
  
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`[WebRTC] Client connected: ${client.id}`);
  }

  handleDisconnect(client: AuthenticatedSocket) {
    const userId = this.socketToUser.get(client.id);
    
    if (userId) {
      console.log(`[WebRTC] User ${userId} disconnected (socket: ${client.id})`);
      
      // Find and notify rooms this user was in
      for (const [roomId, users] of this.videoRooms.entries()) {
        if (users.has(userId)) {
          users.delete(userId);
          
          // Notify other users in the room
          client.to(roomId).emit('user-disconnected', userId);
          
          console.log(`[WebRTC] User ${userId} removed from room ${roomId}`);
          
          // Clean up empty rooms
          if (users.size === 0) {
            this.videoRooms.delete(roomId);
            console.log(`[WebRTC] Room ${roomId} deleted (empty)`);
          }
        }
      }
      
      // Clean up mappings
      this.socketToUser.delete(client.id);
      this.userToVideoSocket.delete(userId);
    }
  }

  @SubscribeMessage('join-video-room')
  async handleJoinRoom(
    @MessageBody() roomId: string,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    console.log('\n=== JOIN VIDEO ROOM ===');
    console.log('RoomId:', roomId);
    console.log('Socket ID:', client.id);

    const currentUserId = client.data.user?.id;
    const username = client.data.user?.email;

    console.log('User ID:', currentUserId);
    console.log('Username:', username);

    if (!currentUserId) {
      console.warn(`Client ${client.id} not authenticated`);
      client.emit('error', { message: 'User not authenticated' });
      return;
    }

    // Verify room exists
    const room = await this.chatService.checkRoomId(roomId);
    if (!room) {
      console.error('Room not found:', roomId);
      throw new WsException('Room does not exist: ' + roomId);
    }

    console.log('Room members:', room.members);
    console.log('Room members type:', typeof room.members[0]);

    // Convert both to strings for comparison (MongoDB IDs might be ObjectId type)
    const currentUserIdStr = String(currentUserId);
    const memberIds = room.members.map(id => String(id));
    
    console.log('Current user ID (string):', currentUserIdStr);
    console.log('Member IDs (strings):', memberIds);

    // Find chat partner - must be different user
    const chatPartner = memberIds.find(
      (memberId) => memberId !== currentUserIdStr,
    );

    console.log('Chat partner found:', chatPartner);
    console.log('Chat partner type:', typeof chatPartner);

    // Track this connection
    this.socketToUser.set(client.id, currentUserId);
    this.userToVideoSocket.set(currentUserId, client.id);

    // Initialize room if it doesn't exist
    if (!this.videoRooms.has(roomId)) {
      this.videoRooms.set(roomId, new Set());
    }

    // Add user to room
    this.videoRooms.get(roomId)!.add(currentUserId);
    await client.join(roomId);

    console.log(`User ${currentUserId} joined video room ${roomId}`);
    console.log(`Room ${roomId} now has ${this.videoRooms.get(roomId)!.size} users`);

    // Check who else is already in the room via socket.io
    const socketsInRoom = await this.server.in(roomId).fetchSockets();
    console.log(`Sockets already in room: ${socketsInRoom.length}`);
    
    const otherUsersInRoom = socketsInRoom
      .filter(s => s.id !== client.id)
      .map(s => (s as any).data?.user?.id)
      .filter(Boolean);
    
    console.log('Other users already in room:', otherUsersInRoom);

    // Send partner info to joining user
    client.emit('chatting-partner', { 
      chatPartner, 
      currentUserId, 
      username 
    });

    // Notify others in the room that new user joined
    if (otherUsersInRoom.length > 0) {
      console.log(`Notifying ${otherUsersInRoom.length} other user(s) about new join`);
      client.to(roomId).emit('user-joined', { 
        userId: currentUserId,
        username 
      });
    }

    console.log('=== JOIN VIDEO ROOM END ===\n');
  }

  @SubscribeMessage('leave-video-room')
  async handleLeaveRoom(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const { roomId } = data;
    const userId = client.data.user?.id;

    if (!userId) return;

    console.log(`[WebRTC] User ${userId} leaving room ${roomId}`);

    // Remove from room tracking
    const roomUsers = this.videoRooms.get(roomId);
    if (roomUsers) {
      roomUsers.delete(userId);
      
      // Notify others
      client.to(roomId).emit('user-disconnected', userId);
      
      // Clean up empty room
      if (roomUsers.size === 0) {
        this.videoRooms.delete(roomId);
      }
    }

    // Leave socket.io room
    await client.leave(roomId);

    // Clean up mappings
    this.socketToUser.delete(client.id);
    this.userToVideoSocket.delete(userId);

    console.log(`[WebRTC] User ${userId} left room ${roomId}`);
  }

  @SubscribeMessage('offer')
  handleOffer(
    @MessageBody()
    data: {
      roomId: string;
      offer: RTCSessionDescriptionInit;
    },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const userId = client.data.user?.id;
    console.log(`[WebRTC] Offer from ${userId} in room ${data.roomId}`);

    // Broadcast to everyone in the room except sender
    client.to(data.roomId).emit('offer', {
      from: userId,
      offer: data.offer,
    });

    console.log(`[WebRTC] Offer broadcasted to room ${data.roomId}`);
  }

  @SubscribeMessage('answer')
  handleAnswer(
    @MessageBody()
    data: {
      roomId: string;
      answer: RTCSessionDescriptionInit;
    },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const userId = client.data.user?.id;
    console.log(`[WebRTC] Answer from ${userId} in room ${data.roomId}`);

    client.to(data.roomId).emit('answer', {
      from: userId,
      answer: data.answer,
    });

    console.log(`[WebRTC] Answer broadcasted to room ${data.roomId}`);
  }

  @SubscribeMessage('ice-candidate')
  handleIceCandidate(
    @MessageBody() data: { roomId: string; candidate: RTCIceCandidateInit },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const userId = client.data.user?.id;
    
    // Broadcast to others in room
    client.to(data.roomId).emit('ice-candidate', {
      sender: userId,
      candidate: data.candidate,
    });
  }

}
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
      process.env.NODE_ENV === 'production'
        ? process.env.FRONTEND_URL
        : 'http://localhost:3000',
      'http://127.0.0.1:5500/socket-connect.html',
      'https://localhost:5500',
      'https:127.0.0.1:5500',
    ],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
@UseGuards(JwtWsGuard)
export class WebRtcGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(private chatService: ChatService) {}
  @WebSocketServer()
  server: Server;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  handleConnection(_client: Socket) {
    // console.log(`Client connected for RTC : ${client.id}`);
  }

  handleDisconnect(client: AuthenticatedSocket) {
    const userId = client.data.user?.id;
    const roomId = client.rooms
      ? Array.from(client.rooms).find((r) => r !== client.id)
      : null;

    if (roomId && userId) {
      console.log(`User ${userId} disconnected from video room ${roomId}`);
      // Notify other users in the room
      client.to(roomId).emit('user-disconnected', userId);
    }
  }

  @SubscribeMessage('join-video-room')
  async handleJoinRoom(
    @MessageBody() roomId: string,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    console.log('=== JOIN VIDEO ROOM ===');
    console.log('RoomId received:', roomId);
    console.log('Client ID:', client.id);
    console.log('Client data:', client.data);
    console.log('User from client:', client.data.user);

    const currentUserId = client.data.user?.id;
    const username = client.data.user?.email;

    console.log('Extracted userId:', currentUserId);
    console.log('Extracted username:', username);

    if (!currentUserId) {
      console.warn(`Client ${client.id} tried to join without username`);
      client.emit('error', { message: 'User not authenticated' });
      return;
    }

    const room = await this.chatService.checkRoomId(roomId);
    if (!room) {
      console.error('Room not found:', roomId);
      throw new WsException('Room Id doesnt exist for ' + roomId);
    }

    console.log('Room found:', room);
    console.log('Room members:', room.members);

    const chatPartner = room.members.find(
      (memberId) => memberId !== currentUserId,
    );

    console.log('Chat partner:', chatPartner);

    await client.join(roomId);

    console.log(`User ${currentUserId} (${client.id}) joined room ${roomId}`);

    // Notify the joining user about their partner
    client.emit('chatting-partner', { chatPartner, currentUserId, username });
    console.log('Emitted chatting-partner event to', currentUserId);

    // If there's a partner already in the room, notify them that someone joined
    if (chatPartner) {
      // Get all sockets in the room and notify the partner
      const socketsInRoom = await this.server.in(roomId).fetchSockets();
      socketsInRoom.forEach((socket) => {
        const socketUserId = (socket as unknown as AuthenticatedSocket).data
          .user?.id;
        if (socketUserId === chatPartner && socketUserId !== currentUserId) {
          // Notify the existing user that someone joined
          this.server.to(socket.id).emit('user-joined', currentUserId);
          // Also re-send chatting-partner to update their state
          this.server.to(socket.id).emit('chatting-partner', {
            chatPartner: currentUserId,
            currentUserId: socketUserId,
            username: (socket as unknown as AuthenticatedSocket).data.user
              ?.email,
          });
          console.log(
            `Notified user ${socketUserId} that ${currentUserId} joined`,
          );
        }
      });
    }
  }

  @SubscribeMessage('leave-video-room')
  async handleLeaveRoom(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const { roomId } = data;

    const roomExists = await this.chatService.checkRoomId(roomId);
    if (!roomExists) throw new WsException('Room Id doesnt exist for' + roomId);

    await client.leave(roomId);

    console.log(
      `User ${client.data.user?.id} (${client.id}) left room ${roomId}`,
    );
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
    console.log(
      `Offer received from ${client.data.user?.id} in room ${data.roomId}`,
    );

    // Broadcast to everyone in the room except the sender
    client.to(data.roomId).emit('offer', {
      from: client.data.user?.id,
      offer: data.offer,
    });

    console.log(`Offer broadcasted to room ${data.roomId}`);
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
    console.log(
      `Answer received from ${client.data.user?.id} in room ${data.roomId}`,
    );

    client.to(data.roomId).emit('answer', {
      from: client.data.user?.id,
      answer: data.answer,
    });

    console.log(`Answer broadcasted to room ${data.roomId}`);
  }

  @SubscribeMessage('ice-candidate')
  handleIceCandidate(
    @MessageBody() data: { roomId: string; candidate: RTCIceCandidateInit },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const senderId = client.data.user?.id;
    console.log(
      `ICE candidate from ${senderId} (${client.id}) in room ${data.roomId}`,
    );

    // Broadcast to room EXCEPT the sender (client.to excludes sender)
    client.to(data.roomId).emit('ice-candidate', {
      sender: senderId,
      candidate: data.candidate,
    });
    console.log(
      `ICE candidate broadcasted to room ${data.roomId} (excluding sender ${senderId})`,
    );
  }
}

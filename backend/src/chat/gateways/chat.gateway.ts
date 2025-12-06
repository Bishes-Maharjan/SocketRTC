/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-misused-promises */
import { UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
    ConnectedSocket,
    MessageBody,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
    WsException,
} from '@nestjs/websockets';
import { parse } from 'cookie';
import { Server } from 'socket.io';
import { JwtWsGuard } from 'src/auth/guard/jwtWsStrategy';
import { MessageService } from 'src/message/message.service';
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
  },
  credentials: true,
  transports: ['websocket', 'polling'],
})
export class ChatGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  // Map to store userId -> socketId for quick lookup
  private userSockets = new Map<string, Set<string>>(); // userId -> Set of socket IDs

  // Map to track which rooms each socket is in
  private socketRooms = new Map<string, Set<string>>(); // socketId -> Set of room IDs

  constructor(
    private chatService: ChatService,
    private messageService: MessageService,
    private jwtService: JwtService,
  ) {}

  @WebSocketServer()
  server: Server;
  afterInit(server: Server) {
    server.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = this.extractTokenFromCookies(socket);

        if (!token) {
          return next(new Error('Authentication error: No token'));
        }

        const payload = await this.jwtService.verifyAsync(token, {
          secret: process.env.JWT_SECRET,
        });

        socket.data.user = {
          id: payload?.id,
          email: payload?.email,
        };

        next();
      } catch (error) {
        console.log('Auth error:', error.message);
        next(new Error('Authentication error'));
      }
    });
  }

  private extractTokenFromCookies(socket: AuthenticatedSocket): string | null {
    const cookieHeader = socket.handshake.headers.cookie;

    if (!cookieHeader) {
      return null;
    }

    const cookies = parse(cookieHeader);

    return cookies.jwt || cookies.token || null;
  }

  handleConnection(client: AuthenticatedSocket) {
    console.log('\n===Handle Connection===');
    const user = client.data.user;
    const userId = user?.id;

    if (!client.data.user?.id)
      console.log(' No user Id is being authenticated');

    console.log(
      `Client connected: \n socketId: ${client.id}, userId: ${userId}, email: ${user.email}`,
    );

    if (userId) {
      // Track this socket for this user
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client.id);

      // Join user to their personal room for receiving messages without joining chat rooms
      const userRoom = `user:${userId}`;
      void client.join(userRoom);
      console.log(`User ${userId} joined personal room: ${userRoom}`);

      console.log('User Socket', this.userSockets);
      console.log('\n===End of Handle Connection===');
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    const userId = client.data.user?.id;
    console.log(`Client disconnected: ${client.id}`);

    // Clean up user socket tracking
    if (userId) {
      this.userSockets.get(userId)?.delete(client.id);
      if (this.userSockets.get(userId)?.size === 0) {
        this.userSockets.delete(userId);
      }
    }

    // Clean up room tracking
    this.socketRooms.delete(client.id);

    client.disconnect();
  }

  /**
   * Check if a user is currently in a specific room
   */
  private isUserInRoom(userId: string, roomId: string): boolean {
    const userSocketIds = this.userSockets.get(userId);
    if (!userSocketIds) return false;

    // Check if any of the user's sockets are in this room
    for (const socketId of userSocketIds) {
      const socketRooms = this.socketRooms.get(socketId);
      if (socketRooms?.has(roomId)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Alternative: Use Socket.io's built-in room checking
   */
  private async isUserInRoomNative(
    userId: string,
    roomId: string,
  ): Promise<boolean> {
    const socketsInRoom = await this.getUsersInRoom(roomId);
    const result = socketsInRoom.find(
      (socket) => socket.split(' ')[0] == userId,
    );
    console.log(result);
    return !!result;
  }

  /**
   * Get all users currently in a room
   */
  private async getUsersInRoom(roomId: string): Promise<string[]> {
    const socketsInRoom = await this.server.in(roomId).fetchSockets();

    const userIds = new Set<string>();
    socketsInRoom.forEach((socket) => {
      const userId =
        (socket as unknown as AuthenticatedSocket).data.user?.id +
        ' ' +
        socket.data.user?.email;
      if (userId) userIds.add(userId);
    });

    return Array.from(userIds);
  }

  /**
   * Get count of users in a room
   */
  private async getRoomUserCount(roomId: string): Promise<number> {
    const users = await this.getUsersInRoom(roomId);
    return users.length;
  }

  @UseGuards(JwtWsGuard)
  @SubscribeMessage('join-room')
  async joinRoom(
    @MessageBody() { roomId }: { roomId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    console.log('\n===Join Room ===');
    await client.join(roomId);

    const user = client.data.user;
    const userId = user?.id;
    const userEmail = user?.email;
    console.log(`User Id: ${userId}, User Email: ${userEmail}`);

    // Track this room for this socket
    if (!this.socketRooms.has(client.id)) {
      this.socketRooms.set(client.id, new Set());
    }
    this.socketRooms.get(client.id)!.add(roomId);

    // Mark all messages as read when user joins the room
    await this.messageService.markRoomMessagesAsRead(roomId, userId);

    // Emit to all clients in the room that messages were marked as read
    this.server.to(roomId).emit('messages-marked-read', {
      roomId,
      userId,
    });

    // Also emit to user's personal room for chat list updates
    const userRoom = `user:${userId}`;
    this.server.to(userRoom).emit('messages-marked-read', {
      roomId,
      userId,
    });

    // Log who's in the room
    const usersInRoom = await this.getUsersInRoom(roomId);
    console.log(`Users in room ${roomId}:`, usersInRoom);

    client.to(roomId).emit('user-joined', {
      userId,
      clientId: client.id,
      timestamp: new Date(),
    });
    console.log('\n===Join-Room-End===');
  }

  @SubscribeMessage('leave-room')
  async leaveRoom(
    @MessageBody() { roomId }: { roomId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    await client.leave(roomId);

    // Remove room from tracking
    this.socketRooms.get(client.id)?.delete(roomId);

    const userId = client.data.user?.id;
    client.to(roomId).emit('user-left', {
      userId,
      clientId: client.id,
      timestamp: new Date(),
    });
  }

  @SubscribeMessage('send-message')
  async sendMessage(
    @MessageBody() { roomId, message }: { roomId: string; message: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    console.log('\n===Send Message===');
    if (!roomId || !message) {
      throw new WsException('Room ID and message are required');
    }

    const roomExists = await this.chatService.checkRoomId(roomId);
    if (!roomExists) throw new WsException('Room Id doesnt exist for' + roomId);

    if (!client.data.user?.id) throw new WsException('Sender Id is missing');

    const senderId = client.data.user.id;
    const chatPartner = roomExists.members.find((id) => id != senderId) || '';

    const recipientIsInRoom = await this.isUserInRoomNative(
      chatPartner,
      roomId,
    );

    console.log(`Sending message in room ${roomId}`);
    console.log(`Sender: ${senderId}`);
    console.log(`Recipient: ${chatPartner}`);
    console.log(`Recipient is in room: ${recipientIsInRoom}`);

    // Save message with appropriate read status
    const savedMessage = await this.messageService.registerMessage(
      roomId,
      message,
      senderId,
      chatPartner,
      recipientIsInRoom,
    );

    const messageData = {
      _id: savedMessage._id,
      sender: senderId,
      to: chatPartner,
      message,
      roomId,
      isRead: savedMessage.isRead,
      createdAt: savedMessage.createdAt,
      updatedAt: savedMessage.updatedAt,
    };

    // Emit message to everyone in the chat room (for active viewers)
    this.server.to(roomId).emit('receive-message', messageData);

    // Also emit to recipient's personal room (for chat list updates)
    // This allows the global socket to receive messages without joining chat rooms
    const recipientUserRoom = `user:${chatPartner}`;
    this.server.to(recipientUserRoom).emit('receive-message', messageData);

    // If message was auto-read, notify sender
    if (recipientIsInRoom) {
      this.server.to(roomId).emit('messages-marked-read', {
        roomId,
        userId: chatPartner,
      });
      // Also notify recipient's personal room
      this.server.to(recipientUserRoom).emit('messages-marked-read', {
        roomId,
        userId: chatPartner,
      });
    }
    console.log('\n===End of send message===');
  }

  @UseGuards(JwtWsGuard)
  @SubscribeMessage('typing')
  handleTyping(
    @MessageBody() { roomId }: { roomId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const userId = client.data.user?.id;
    if (!userId || !roomId) return;

    // Emit typing event to all other users in the room
    client.to(roomId).emit('user-typing', {
      roomId,
      userId,
      userName: client.data.user?.email,
    });

    // Also emit to user's personal room for chat list updates
    const userRoom = `user:${userId}`;
    this.server.to(userRoom).emit('user-typing', {
      roomId,
      userId,
      userName: client.data.user?.email,
    });
  }

  @UseGuards(JwtWsGuard)
  @SubscribeMessage('stop-typing')
  handleStopTyping(
    @MessageBody() { roomId }: { roomId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const userId = client.data.user?.id;
    if (!userId || !roomId) return;

    // Emit stop typing event to all other users in the room
    client.to(roomId).emit('user-stopped-typing', {
      roomId,
      userId,
    });

    // Also emit to user's personal room for chat list updates
    const userRoom = `user:${userId}`;
    this.server.to(userRoom).emit('user-stopped-typing', {
      roomId,
      userId,
    });
  }

  @UseGuards(JwtWsGuard)
  @SubscribeMessage('call-request')
  async handleCallRequest(
    @MessageBody() { roomId }: { roomId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const roomExists = await this.chatService.checkRoomId(roomId);
    if (!roomExists) throw new WsException('Room Id doesnt exist for' + roomId);
    
    const fromUserId = client.data.user?.id;
    const callerName = client.data.user?.email || 'Unknown User';
    
    // Emit to the room - all users in the room will receive it
    // Frontend will filter to show only to the recipient
    this.server.to(roomId).emit('incoming-call', { 
      roomId, 
      from: fromUserId, 
      callerName 
    });
    console.log(`Call request sent to room ${roomId} from ${fromUserId}`);
  }

  @UseGuards(JwtWsGuard)
  @SubscribeMessage('call-cancel')
  handleCallCancel(
    @MessageBody() { roomId }: { roomId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const cancelerId = client.data.user?.id;
    
    // Emit to the room
    this.server.to(roomId).emit('call-cancelled', { roomId, canceller: cancelerId });
    console.log(`Call cancelled in room ${roomId} by ${cancellerId}`);
  }

  @UseGuards(JwtWsGuard)
  @SubscribeMessage('call-accept')
  handleCallAccept(
    @MessageBody() { roomId }: { roomId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const accepterId = client.data.user?.id;
    
    // Emit to the room
    this.server.to(roomId).emit('call-accepted', { roomId, accepter: accepterId });
    console.log(`Call accepted in room ${roomId} by ${accepterId}`);
  }

  @UseGuards(JwtWsGuard)
  @SubscribeMessage('call-reject')
  handleCallReject(
    @MessageBody() { roomId }: { roomId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const rejecterId = client.data.user?.id;
    
    // Emit to the room
    this.server.to(roomId).emit('call-rejected', { roomId, rejecter: rejecterId });
    console.log(`Call rejected in room ${roomId} by ${rejecterId}`);
  }

  /**
   * Debug endpoint to check room status
   */
  @SubscribeMessage('debug-room')
  async debugRoom(
    @MessageBody() { roomId }: { roomId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const usersInRoom = await this.getUsersInRoom(roomId);
    const userCount = await this.getRoomUserCount(roomId);

    client.emit('debug-room-response', {
      roomId,
      users: usersInRoom,
      count: userCount,
      yourUserId: client.data.user?.id,
      yourSocketId: client.id,
    });
  }
}

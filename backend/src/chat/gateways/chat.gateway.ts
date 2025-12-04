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
@UseGuards(JwtWsGuard)
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private chatService: ChatService,
    private messageService: MessageService,
  ) {}

  @WebSocketServer()
  server: Server;

  @UseGuards(JwtWsGuard)
  handleConnection(client: AuthenticatedSocket) {
    console.log(`Client connected: ${client.id}, user:`, client.data.user?.id);
  }

  handleDisconnect(client: AuthenticatedSocket) {
    console.log(`Client disconnected: ${client.id}`);

    client.disconnect();
  }

  @SubscribeMessage('join-room')
  async joinRoom(
    @MessageBody() { roomId }: { roomId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    await client.join(roomId);

    const user = client.data.user;
    const userId = user?.id ?? user?.email ?? client.id;

    // Mark all messages in this room as read for this user
    await this.messageService.markRoomMessagesAsRead(roomId, userId);

    client.to(roomId).emit('user-joined', {
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
    if (!roomId || !message) {
      throw new WsException('Room ID and message are required');
    }
    const roomExists = await this.chatService.checkRoomId(roomId);
    if (!roomExists) throw new WsException('Room Id doesnt exist for' + roomId);

    if (!client.data.user?.id) throw new WsException('Sender Id is missing');

    const senderId = client.data.user.id;
    const chatPartner = roomExists.members.find((id) => id != senderId) || '';

    // Save message with appropriate read status
    const savedMessage = await this.messageService.registerMessage(
      roomId,
      message,
      senderId,
      chatPartner,
    );

    // Emit message to everyone in the room
    this.server.to(roomId).emit('receive-message', {
      _id: savedMessage._id,
      sender: senderId,
      message,
    });
  }
}

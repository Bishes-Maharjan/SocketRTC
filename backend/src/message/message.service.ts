import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Message, MessageDocument } from './models/message.model';

@Injectable()
export class MessageService {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
  ) {}

  //for infinite query for chat window , rendering messages
  async getRoomMessagesWithItsUnreadCount(
    userId: string,
    roomId: string,
    query: { limit: number; page: number },
  ): Promise<{
    messages: MessageDocument[];
    unreadCount: number;
    hasMore: boolean;
  }> {
    const skip = (query.page - 1) * query.limit;
    const messages = await this.messageModel
      .find({ roomId })
      .limit(query.limit)
      .skip(skip)
      .sort({ createdAt: -1 })
      .exec();

    const unreadCount = await this.messageModel.countDocuments({
      to: userId,
      roomId,
      isRead: false,
    });
    const total = await this.messageModel.countDocuments({
      roomId,
    });

    const hasMore = skip + messages.length < total;
    return { messages, unreadCount, hasMore };
  }
  // In your message.service.ts
  async registerMessage(
    roomId: string,
    message: string,
    senderId: string,
    recipientId: string,
  ) {
    const newMessage = await this.messageModel.create({
      roomId,
      message,
      sender: senderId,
      to: recipientId,
    });

    return newMessage;
  }

  async markRoomMessagesAsRead(roomId: string, userId: string) {
    // Mark all unread messages in this room where userId is the recipient
    await this.messageModel.updateMany(
      {
        roomId,
        to: userId,
        isRead: false,
      },
      {
        $set: { isRead: true },
      },
    );

    // Return the IDs of marked messages (you might need to fetch them first)
    const markedMessages = await this.messageModel
      .find({
        roomId,
        to: userId,
        isRead: true,
      })
      .select('_id');

    return markedMessages.map((msg) => msg._id.toString());
  }
  async readMessage(roomId: string, userId: string) {
    const updateMessageStatus = await this.messageModel.updateMany(
      {
        roomId,
        to: userId,
      },
      {
        isRead: true,
      },
    );
    if (!updateMessageStatus)
      throw new InternalServerErrorException('Something went wrong');
    return { sucess: true, message: 'Read all messages' };
  }
  //for a chat notification badge to show total undred messages
  async getTotalUnreadMessages(id: string) {
    const unread = await this.messageModel.countDocuments({
      to: id,
      isRead: false,
    });
    return unread;
  }
}

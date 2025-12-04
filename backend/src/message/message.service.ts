import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Message, MessageDocument } from './models/message.model';

@Injectable()
export class MessageService {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
  ) {}

  async registerMessage(
    roomId: string,
    message: string,
    sender: string,
    to: string,
  ) {
    const newMessage = new this.messageModel({ roomId, message, sender, to });
    await newMessage.save();
  }
  async getRoomMessagesWithItsUnreadCount(
    userId: string,
    roomId: string,
    query: { limit?: number; page?: number },
  ): Promise<{ messages: MessageDocument[]; unreadCount: number }> {
    const messages = await this.messageModel
      .find({ roomId })
      .limit(query.limit || 20)
      .skip((query.page || 1) - 1)
      .sort({ createdAt: 1 })
      .exec();

    const unreadCount = await this.messageModel.countDocuments({
      to: userId,
      roomId,
      isRead: false,
    });

    return { messages, unreadCount };
  }

  async getTotalUnreadMessages(id: string) {
    const unread = await this.messageModel.countDocuments({ to: id });
    return unread;
  }
}

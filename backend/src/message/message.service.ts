import { Injectable, InternalServerErrorException } from '@nestjs/common';
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
      to: userId,
      roomId,
    });

    const hasMore = skip + messages.length < total;
    return { messages, unreadCount, hasMore };
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
    const unread = await this.messageModel.countDocuments({ to: id });
    return unread;
  }
}

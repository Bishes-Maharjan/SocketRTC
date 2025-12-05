import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MessageService } from 'src/message/message.service';
import { User } from 'src/user/model/user.model';
import { Chat, ChatDocument } from './model/chat.model';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Chat.name) private chatModel: Model<ChatDocument>,
    private messageService: MessageService,
  ) {}
  async getChatRoomId(recpientId: string, userId: string) {
    const chatExist = await this.chatModel.findOne({
      members: { $all: [recpientId, userId] },
    });
    if (chatExist) return chatExist;
  }

  async createChatRoomId(recpientId: string, userId: string) {
    const chatExist = await this.getChatRoomId(recpientId, userId);
    if (chatExist) return chatExist;
    const chat = await this.chatModel.create({
      members: [recpientId, userId],
    });
    await chat.save();
    return chat;
  }

  async checkRoomId(roomId: string): Promise<ChatDocument> {
    const chat = await this.chatModel.findOne({ _id: roomId });
    if (!chat) throw new NotFoundException('Room Id doesnt exist');
    return chat;
  }

  async getAllChatRooms(
    userId: string,
    { limit, page }: { limit: number; page: number },
  ): Promise<{
    chats: Array<any>; // Use 'any' for now, or create a proper interface
    hasMore: boolean;
  }> {
    const skip = (page - 1) * limit;
    const chats = await this.chatModel
      .find({ members: { $in: [userId] } })
      .populate<{ members: User[] }>('members')
      .limit(limit || 20)
      .skip(skip)
      .exec();

    const result = await Promise.all(
      chats.map(async (chat) => {
        const { messages, unreadCount } =
          await this.messageService.getRoomMessagesWithItsUnreadCount(
            userId,
            String(chat._id),
            { limit: 1, page: 1 },
          );

        return {
          ...chat.toObject(),
          members: chat.members.find(
            (member) => member._id.toString() != userId,
          ),
          messages,
          unreadCount,
        };
      }),
    );

    const total = await this.chatModel.countDocuments({
      members: { $in: [userId] },
    });

    return {
      chats: result,
      hasMore: skip + result.length < total,
    };
  }

  async getChatById(
    roomId: string,
    us: string,
  ): Promise<{
    chat: unknown;
  }> {
    const chat = await this.chatModel
      .findById(roomId)
      .populate('members')
      .lean();
    if (!chat) throw new NotFoundException('Room Id doesnt exist');
    const result = {
      ...chat,
      members: chat.members.find((member) => member != us),
    };
    return { chat: result };
  }
}

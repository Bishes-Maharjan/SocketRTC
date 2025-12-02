import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { StreamService } from 'src/stream/stream.service';
import { Chat, ChatDocument } from './model/chat.model';

@Injectable()
export class ChatService {
  constructor(
    private stream: StreamService,
    @InjectModel(Chat.name) private chatModel: Model<Chat>,
  ) {}
  getStreamToken(id: string) {
    const token = this.stream.generateUserToken(id);

    return token;
  }
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

  // async getAllChatRooms(userId: string): Promise<any[]> {
  //   const chats = await this.chatModel.find({ members: { $in: [userId] } });

  //   const chattingPartnerPromises = chats.map(async (chat) => {
  //     const partnerId = chat.members.find((member) => member !== userId);
  //     if (!partnerId) throw new NotFoundException('Partner Id doesnt exist');

  //     const user = await this.userService.getUserById(partnerId);

  //     return {
  //       ...user,
  //       roomId: chat._id,
  //     };
  //   });

  //   return Promise.all(chattingPartnerPromises);
  // }

  // async getRoomIdByUserId(friendsId: string[]) {
  //   const chat = await this.chatModel.findOne({ members: { $: [userId] } });
  //   if (!chat) throw new NotFoundException('Room Id doesnt exist');
  //   return chat._id;
  // }
}

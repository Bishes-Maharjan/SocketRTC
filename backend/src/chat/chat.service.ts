/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model } from 'mongoose';
import { MessageService } from 'src/message/message.service';
import { User } from 'src/user/model/user.model';
import { Chat, ChatDocument } from './model/chat.model';
import { Message, MessageDocument } from 'src/message/models/message.model';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Chat.name) private chatModel: Model<ChatDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
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
    chats: Array<any>;
    hasMore: boolean;
  }> {
    const skip = (page - 1) * limit;

    // Use aggregation to join with messages collection and sort
    const chats = await this.chatModel.aggregate([
      // Match chats where user is a member
      {
        $match: {
          members: new mongoose.Types.ObjectId(userId),
        },
      },

      // Lookup the most recent message for each chat
      {
        $lookup: {
          from: 'messages', // Your messages collection name
          let: { chatId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$roomId', { $toString: '$$chatId' }],
                },
              },
            },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
          ],
          as: 'lastMessageArray',
        },
      },

      // Extract the last message and its timestamp
      {
        $addFields: {
          lastMessage: { $arrayElemAt: ['$lastMessageArray', 0] },
          lastMessageTime: {
            $ifNull: [
              { $arrayElemAt: ['$lastMessageArray.createdAt', 0] },
              new Date(0), // Chats with no messages go to bottom
            ],
          },
        },
      },

      // Sort by last message time (descending - most recent first)
      { $sort: { lastMessageTime: -1 } },

      // Count total before pagination
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          data: [{ $skip: skip }, { $limit: limit }],
        },
      },
    ]);

    const total = chats[0]?.metadata[0]?.total || 0;
    const chatData = chats[0]?.data || [];

    // Populate members and get unread count
    const result = await Promise.all(
      chatData.map(async (chat) => {
        // Populate members
        const populatedChat = await this.chatModel
          .findById(chat._id)
          .populate<{ members: User[] }>('members')
          .exec();

        // Get unread count for this user
        const unreadCount = await this.messageModel.countDocuments({
          to: userId,
          roomId: chat._id.toString(),
          isRead: false,
        });

        if (!populatedChat) return null;
        return {
          ...populatedChat.toObject(),
          members: populatedChat.members.find(
            (member) => member._id.toString() !== userId,
          ),
          messages: chat.lastMessage ? [chat.lastMessage] : [],
          unreadCount,
        };
      }),
    );

    return {
      chats: result,
      hasMore: skip + result.length < total,
    };
  }

  async getChatById(partnerId: string, userId: string): Promise<ChatDocument> {
    const chat = (await this.chatModel
      .findOne({ members: { $all: [partnerId, userId] } })
      .populate('members')
      .lean()) as ChatDocument;
    if (!chat) throw new NotFoundException('Room Id doesnt exist');
    return chat;
  }
}

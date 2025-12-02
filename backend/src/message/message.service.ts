import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Message } from './models/message.model';

@Injectable()
export class MessageService {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<Message>,
  ) {}

  async getMessage(roomId: string) {
    const message = await this.messageModel.find({ roomId }).populate('sender');
    return message;
  }

  async registerMessage(roomId: string, message: string, sender: string) {
    const newMessage = new this.messageModel({ roomId, message, sender });
    await newMessage.save();
  }
}

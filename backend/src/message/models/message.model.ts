import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';
import { Chat } from 'src/chat/model/chat.model';
import { User } from 'src/user/model/user.model';

@Schema({ timestamps: true })
export class Message extends Document {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: User.name,
    required: true,
  })
  sender: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Chat.name, required: true })
  roomId: Types.ObjectId;

  @Prop({ type: String, required: true })
  message: string;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

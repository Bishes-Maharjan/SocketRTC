import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument, Types } from 'mongoose';
import { Chat } from 'src/chat/model/chat.model';
import { User } from 'src/user/model/user.model';

@Schema({ timestamps: true })
export class Message {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: User.name,
    required: true,
  })
  sender: Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: User.name,
    required: true,
  })
  to: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Chat.name, required: true })
  roomId: Types.ObjectId;

  @Prop({ type: String, required: true })
  message: string;

  @Prop({ type: Boolean, required: true, default: false })
  isRead: boolean;

  createdAt: string;
  updatedAt: string;
}
export type MessageDocument = HydratedDocument<Message>;
export const MessageSchema = SchemaFactory.createForClass(Message);

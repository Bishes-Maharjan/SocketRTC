import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { User } from './user.model';

@Schema({ timestamps: true })
export class FriendRequest {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: User.name,
    required: true,
  })
  sender: string;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: User.name,
    required: true,
  })
  receiver: string;

  @Prop({
    type: String,
    enum: ['accepted', 'pending', 'rejected'],
    required: true,
    default: 'pending',
  })
  status: string;

  @Prop({
    type: Boolean,
    default: false,
  })
  isRead: boolean;
}

export type FriendRequestDocument = Document & FriendRequest;
export const FriendRequestSchema = SchemaFactory.createForClass(FriendRequest);

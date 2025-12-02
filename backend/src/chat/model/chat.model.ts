import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ArrayMinSize } from 'class-validator';
import mongoose, { Document, HydratedDocument } from 'mongoose';
import { User } from 'src/user/model/user.model';

@Schema({ timestamps: true })
export class Chat extends Document {
  @Prop({
    type: [mongoose.Schema.Types.ObjectId],
    required: true,
    ref: User.name,
  })
  @ArrayMinSize(2)
  members: string[];
}
export type ChatDocument = HydratedDocument<Chat>;
export const ChatSchema = SchemaFactory.createForClass(Chat);

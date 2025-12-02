import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import * as bcrypt from 'bcrypt';
import mongoose, { HydratedDocument } from 'mongoose';
@Schema({ timestamps: true })
export class User {
  @Prop({ type: String, required: true, minlength: 2 })
  email: string;

  @Prop({ type: String, required: false, minlength: 2 })
  password?: string;

  @Prop({ type: String, required: false, minlength: 2 })
  image?: string;

  @Prop({ type: Boolean, required: true, default: false })
  isDeleted: boolean;

  @Prop({
    type: String,
    required: false,
    default: 'local',
    enum: ['local', 'google'],
  })
  provider: string;

  @Prop({
    type: Boolean,
    default: false,
  })
  isOnBoarded: boolean;

  @Prop({ type: String, required: false, minlength: 2 })
  fullName?: string;

  @Prop({ type: String, required: false, minlength: 2 })
  bio?: string;

  @Prop({ type: String, required: false, minlength: 2 })
  nativeLanguage?: string;

  @Prop({ type: String, required: false, minlength: 2 })
  learningLanguage?: string;

  @Prop({ type: String, required: false, minlength: 2 })
  location?: string;

  @Prop({
    type: [mongoose.Schema.Types.ObjectId],
    ref: User.name,
    default: [],
  })
  friends: string[];

  _id: mongoose.Types.ObjectId;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  if (!this.password || this.provider !== 'local') return next();
  const salt = await bcrypt.genSalt(5);
  this.password = await bcrypt.hash(this.password, salt);

  next();
});

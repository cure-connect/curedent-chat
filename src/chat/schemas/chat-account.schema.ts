import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ChatAccountDocument = ChatAccount & Document;

@Schema({ timestamps: true })
export class ChatAccount {
  _id: Types.ObjectId;

  @Prop({ required: true })
  userId: string;

  @Prop({ enum: ['line', 'facebook', 'instagram'], required: true })
  platform: string;

  @Prop({ required: true })
  channelId: string;

  @Prop()
  accessToken: string;

  @Prop()
  secret: string;

  @Prop()
  displayName?: string;
}

export const ChatAccountSchema = SchemaFactory.createForClass(ChatAccount);
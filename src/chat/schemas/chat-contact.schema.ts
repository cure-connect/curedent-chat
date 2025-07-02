import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ChatContactDocument = ChatContact & Document;

@Schema({ timestamps: true })
export class ChatContact {
  @Prop({ required: true })
  chatAccountId: string;

  @Prop({ required: true })
  senderId: string;

  @Prop()
  displayName?: string;

  @Prop()
  pictureUrl?: string;

  @Prop()
  lastMessageAt?: Date;
}

export const ChatContactSchema = SchemaFactory.createForClass(ChatContact);
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ChatMessageDocument = ChatMessage & Document;

@Schema({ timestamps: true })
export class ChatMessage {
  @Prop({ required: true })
  chatAccountId: string;

  @Prop({ required: true })
  senderId: string;

  @Prop()
  messageId?: string;

  @Prop({ required: true })
  text: string;

  @Prop({ enum: ['user', 'bot', 'admin'], required: true })
  source: string;

  @Prop({ enum: ['text', 'image', 'flex', 'sticker', 'file'], required: true })
  messageType: string;

  @Prop({ required: true })
  timestamp: Date;

  @Prop()
  stickerId?: string;
  
  @Prop()
  packageId?: string;
  
  // เพิ่มฟิลด์สำหรับไฟล์
  @Prop()
  fileName?: string;
  
  @Prop()
  fileUrl?: string;
  
  @Prop()
  fileSize?: number;
  
  @Prop()
  fileType?: string;
}

export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);
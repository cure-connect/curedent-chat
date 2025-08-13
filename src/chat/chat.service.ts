import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ChatMessage, ChatMessageDocument } from './schemas/chat-message.schema';
import { ChatAccount, ChatAccountDocument } from './schemas/chat-account.schema';
import { ChatContact, ChatContactDocument } from './schemas/chat-contact.schema';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(ChatMessage.name) private chatMessageModel: Model<ChatMessageDocument>,
    @InjectModel(ChatAccount.name) private chatAccountModel: Model<ChatAccountDocument>,
    @InjectModel(ChatContact.name) private chatContactModel: Model<ChatContactDocument>,
  ) {}

  async saveMessage(data: Partial<ChatMessage>): Promise<ChatMessage> {
    const newMessage = new this.chatMessageModel(data);
    return newMessage.save();
  }

  async findMessages(chatAccountId: string, senderId: string): Promise<ChatMessage[]> {
    return this.chatMessageModel.find({ chatAccountId, senderId }).sort({ timestamp: 1 }).exec();
  }
}

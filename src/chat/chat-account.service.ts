import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ChatAccount, ChatAccountDocument } from './schemas/chat-account.schema';

@Injectable()
export class ChatAccountService {
  constructor(
    @InjectModel(ChatAccount.name)
    private readonly chatAccountModel: Model<ChatAccountDocument>,
  ) {}

  async findById(id: string): Promise<ChatAccount> {
    const chatAccount = await this.chatAccountModel.findById(id).exec();
    if (!chatAccount) {
      throw new NotFoundException('ChatAccount not found');
    }
    return chatAccount;
  }

  async findByChannelId(channelId: string): Promise<ChatAccount | null> {
    return this.chatAccountModel.findOne({ platform: 'line', channelId }).exec();
  }

  async findOne(filter: any): Promise<ChatAccount | null> {
    return this.chatAccountModel.findOne(filter).exec();
  }

  async create(data: Partial<ChatAccount>): Promise<ChatAccount> {
    const newAccount = new this.chatAccountModel(data);
    return newAccount.save();
  }

  async findAll(): Promise<ChatAccount[]> {
    return this.chatAccountModel.find().exec();
  }

  async update(id: string, data: Partial<ChatAccount>): Promise<ChatAccount> {
    const updated = await this.chatAccountModel
      .findByIdAndUpdate(id, data, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('ChatAccount not found');
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.chatAccountModel.findByIdAndDelete(id).exec();
  }
}

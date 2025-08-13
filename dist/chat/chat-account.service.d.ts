import { Model } from 'mongoose';
import { ChatAccount, ChatAccountDocument } from './schemas/chat-account.schema';
export declare class ChatAccountService {
    private readonly chatAccountModel;
    constructor(chatAccountModel: Model<ChatAccountDocument>);
    findById(id: string): Promise<ChatAccount>;
    findByChannelId(channelId: string): Promise<ChatAccount | null>;
    findOne(filter: any): Promise<ChatAccount | null>;
    create(data: Partial<ChatAccount>): Promise<ChatAccount>;
    findAll(): Promise<ChatAccount[]>;
    update(id: string, data: Partial<ChatAccount>): Promise<ChatAccount>;
    delete(id: string): Promise<void>;
}

import { Model } from 'mongoose';
import { ChatMessage, ChatMessageDocument } from './schemas/chat-message.schema';
import { ChatAccountDocument } from './schemas/chat-account.schema';
import { ChatContactDocument } from './schemas/chat-contact.schema';
export declare class ChatService {
    private chatMessageModel;
    private chatAccountModel;
    private chatContactModel;
    constructor(chatMessageModel: Model<ChatMessageDocument>, chatAccountModel: Model<ChatAccountDocument>, chatContactModel: Model<ChatContactDocument>);
    saveMessage(data: Partial<ChatMessage>): Promise<ChatMessage>;
    findMessages(chatAccountId: string, senderId: string): Promise<ChatMessage[]>;
}

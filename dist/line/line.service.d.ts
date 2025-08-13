import { Model } from 'mongoose';
import { Client, MessageEvent } from '@line/bot-sdk';
import { ChatMessage, ChatMessageDocument } from '../chat/schemas/chat-message.schema';
import { ChatAccountDocument } from '../chat/schemas/chat-account.schema';
import { ChatGateway } from '../chat/chat.gateway';
export declare class LineService {
    private chatMessageModel;
    private chatAccountModel;
    private readonly chatGateway;
    private readonly logger;
    constructor(chatMessageModel: Model<ChatMessageDocument>, chatAccountModel: Model<ChatAccountDocument>, chatGateway: ChatGateway);
    handleWebhook(body: any): Promise<void>;
    handleStickerMessage(event: MessageEvent, client: Client, chatAccountId: string): Promise<void>;
    handleFileMessage(event: MessageEvent, client: Client, chatAccountId: string): Promise<void>;
    handleImageMessage(event: MessageEvent, client: Client, chatAccountId: string): Promise<void>;
    sendFile(userId: string, file: Express.Multer.File, chatAccountId: string): Promise<void>;
    handleTextMessage(event: MessageEvent, client: Client, chatAccountId: string): Promise<void>;
    pushMessage(userId: string, text: string, chatAccountId: string): Promise<void>;
    saveMessage(data: Partial<ChatMessage>): Promise<ChatMessage>;
    getUserMessageHistory(userId: string, limit?: number): Promise<ChatMessage[]>;
    getUserProfile(userId: string, chatAccountId: string): Promise<any>;
    getChatList(chatAccountId: string): Promise<any[]>;
}

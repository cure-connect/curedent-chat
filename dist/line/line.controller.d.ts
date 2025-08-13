import { LineService } from './line.service';
import { ChatAccountService } from '../chat/chat-account.service';
export declare class LineController {
    private readonly lineService;
    private readonly chatAccountService;
    constructor(lineService: LineService, chatAccountService: ChatAccountService);
    handleWebhook(chatAccountId: string, body: any, signature: string): Promise<string>;
    sendMessage(chatAccountId: string, userId: string, message: string): Promise<{
        success: boolean;
    }>;
    getMessageHistory(chatAccountId: string, userId: string, limit: number): Promise<any>;
    getUserProfile(chatAccountId: string, userId: string): Promise<any>;
    getChatList(chatAccountId: string): Promise<any>;
    uploadFile(chatAccountId: string, userId: string, file: Express.Multer.File): Promise<{
        success: boolean;
    }>;
}

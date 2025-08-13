import { MetaService } from './meta.service';
import { ChatAccountService } from '../chat/chat-account.service';
export declare class MetaController {
    private readonly metaService;
    private readonly chatAccountService;
    private readonly logger;
    constructor(metaService: MetaService, chatAccountService: ChatAccountService);
    verifyWebhookWithAccount(chatAccountId: string, mode: string, verifyToken: string, challenge: string): Promise<string>;
    verifyWebhook(query: any): string;
    handleWebhookWithAccount(chatAccountId: string, body: any, signature: string): Promise<string>;
    handleWebhook(body: any): Promise<string>;
    sendMessage(chatAccountId: string, userId: string, message: string, platform?: 'facebook' | 'instagram'): Promise<{
        success: boolean;
        messageId?: string;
    }>;
    sendTemplate(chatAccountId: string, userId: string, template: any, platform?: 'facebook' | 'instagram'): Promise<{
        success: boolean;
        messageId?: string;
    }>;
    getMessageHistory(chatAccountId: string, userId: string, limit?: number, before?: string, after?: string): Promise<any>;
    getUserProfile(chatAccountId: string, userId: string, platform?: 'facebook' | 'instagram'): Promise<any>;
    getChatList(chatAccountId: string, platform?: 'facebook' | 'instagram', limit?: number): Promise<any>;
    uploadFile(chatAccountId: string, userId: string, file: Express.Multer.File, platform?: 'facebook' | 'instagram', caption?: string): Promise<{
        success: boolean;
        messageId?: string;
    }>;
}

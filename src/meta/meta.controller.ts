import {
    Controller,
    Post,
    Body,
    Get,
    Param,
    Query,
    Headers,
    HttpCode,
    HttpStatus,
    UseInterceptors,
    UploadedFile,
    Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { MetaService } from './meta.service';
import { ChatAccountService } from '../chat/chat-account.service';

@Controller('meta')
export class MetaController {
    private readonly logger = new Logger(MetaController.name);

    constructor(
        private readonly metaService: MetaService,
        private readonly chatAccountService: ChatAccountService,
    ) { }

    @Get('webhook/:chatAccountId')
    async verifyWebhookWithAccount(
        @Param('chatAccountId') chatAccountId: string,
        @Query('hub.mode') mode: string,
        @Query('hub.verify_token') verifyToken: string,
        @Query('hub.challenge') challenge: string,
    ): Promise<string> {
        try {
            const chatAccount = await this.chatAccountService.findByChannelId(chatAccountId);

            if (!chatAccount) {
                this.logger.warn(`Invalid chatAccountId: ${chatAccountId}`);
                return 'Invalid chatAccountId';
            }

            if (mode === 'subscribe' && chatAccount.secret === verifyToken) {
                this.logger.log(`Webhook verified for chatAccountId: ${chatAccountId}`);
                return challenge;
            }

            this.logger.warn(`Invalid verification token for chatAccountId: ${chatAccountId}`);
            return 'Invalid verification token';
        } catch (error) {
            this.logger.error(`Error verifying webhook: ${error.message}`);
            return 'Error verifying webhook';
        }
    }

    @Get('webhook')
    verifyWebhook(@Query() query: any): string {
        const VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN || '';

        if (query['hub.mode'] === 'subscribe' && query['hub.verify_token'] === VERIFY_TOKEN) {
            this.logger.log('Webhook verified with default token');
            return query['hub.challenge'];
        }

        this.logger.warn('Invalid verify token for default webhook');
        return 'Invalid verify token';
    }

    @Post('webhook/:chatAccountId')
    @HttpCode(HttpStatus.OK)
    async handleWebhookWithAccount(
        @Param('chatAccountId') chatAccountId: string,
        @Body() body: any,
        @Headers('x-hub-signature-256') signature: string,
    ): Promise<string> {
        try {
            const chatAccount = await this.chatAccountService.findByChannelId(chatAccountId);

            if (!chatAccount) {
                this.logger.warn(`Invalid chatAccountId: ${chatAccountId}`);
                return 'Invalid chatAccountId';
            }

            // ตรวจสอบ signature
            if (signature && chatAccount.secret) {
                const isValid = await this.metaService.validateSignature(
                    JSON.stringify(body),
                    chatAccount.secret,
                    signature,
                );

                if (!isValid) {
                    this.logger.warn(`Invalid signature for chatAccountId: ${chatAccountId}`);
                    return 'Invalid signature';
                }
            }

            await this.metaService.handleWebhook(body, chatAccount);
            return 'EVENT_RECEIVED';
        } catch (error) {
            this.logger.error(`Error handling webhook: ${error.message}`);
            return 'Error processing webhook';
        }
    }

    @Post('webhook')
    @HttpCode(HttpStatus.OK)
    async handleWebhook(@Body() body: any): Promise<string> {
        try {
            if (body.object === 'page') {
                const pageId = body.entry[0]?.id;
                let chatAccount;

                if (pageId) {
                    chatAccount = await this.chatAccountService.findByChannelId(pageId);
                }

                if (!chatAccount) {
                    const defaultAccessToken = process.env.FB_PAGE_ACCESS_TOKEN || '';
                    if (defaultAccessToken) {
                        chatAccount = await this.chatAccountService.findOne({
                            platform: 'facebook',
                            accessToken: defaultAccessToken
                        });
                    }

                    if (!chatAccount) {
                        chatAccount = await this.chatAccountService.create({
                            platform: 'facebook',
                            channelId: pageId || 'default_page',
                            accessToken: process.env.FB_PAGE_ACCESS_TOKEN || '',
                            userId: 'system',
                            secret: process.env.FB_APP_SECRET || '',
                            displayName: 'Default Facebook Page'
                        });
                    }
                }

                await this.metaService.handleWebhook(body, chatAccount);
                return 'EVENT_RECEIVED';
            }

            this.logger.warn(`Received non-page object: ${body.object}`);
            return 'Not a page object';
        } catch (error) {
            this.logger.error(`Error handling webhook: ${error.message}`);
            return 'Error processing webhook';
        }
    }

    @Post('send/:chatAccountId/:userId')
    async sendMessage(
        @Param('chatAccountId') chatAccountId: string,
        @Param('userId') userId: string,
        @Body('message') message: string,
        @Body('platform') platform: 'facebook' | 'instagram' = 'facebook',
    ): Promise<{ success: boolean; messageId?: string }> {
        try {
            const result = await this.metaService.pushMessage(userId, message, chatAccountId, platform);
            return { success: true, messageId: result?.messageId };
        } catch (error) {
            this.logger.error(`Error sending message: ${error.message}`);
            throw error;
        }
    }

    @Post('send-template/:chatAccountId/:userId')
    async sendTemplate(
        @Param('chatAccountId') chatAccountId: string,
        @Param('userId') userId: string,
        @Body('template') template: any,
        @Body('platform') platform: 'facebook' | 'instagram' = 'facebook',
    ): Promise<{ success: boolean; messageId?: string }> {
        try {
            const result = await this.metaService.sendTemplateMessage(userId, template, chatAccountId, platform);
            return { success: true, messageId: result?.messageId };
        } catch (error) {
            this.logger.error(`Error sending template: ${error.message}`);
            throw error;
        }
    }

    // ดึงประวัติแชทของ userId
    @Get('history/:chatAccountId/:userId')
    async getMessageHistory(
        @Param('chatAccountId') chatAccountId: string,
        @Param('userId') userId: string,
        @Query('limit') limit: number = 50,
        @Query('before') before?: string,
        @Query('after') after?: string,
    ): Promise<any> {
        try {
            return this.metaService.getUserMessageHistory(chatAccountId, userId, limit, before, after);
        } catch (error) {
            this.logger.error(`Error getting message history: ${error.message}`);
            throw error;
        }
    }

    // ดึงข้อมูลโปรไฟล์ของ user
    @Get('user/:chatAccountId/:userId')
    async getUserProfile(
        @Param('chatAccountId') chatAccountId: string,
        @Param('userId') userId: string,
        @Query('platform') platform: 'facebook' | 'instagram' = 'facebook',
    ): Promise<any> {
        try {
            return this.metaService.getUserProfile(userId, chatAccountId, platform);
        } catch (error) {
            this.logger.error(`Error getting user profile: ${error.message}`);
            throw error;
        }
    }

    // ดึงรายการแชทล่าสุด
    @Get('chat-list/:chatAccountId')
    async getChatList(
        @Param('chatAccountId') chatAccountId: string,
        @Query('platform') platform?: 'facebook' | 'instagram',
        @Query('limit') limit: number = 20,
    ): Promise<any> {
        try {
            return this.metaService.getChatList(chatAccountId, platform, limit);
        } catch (error) {
            this.logger.error(`Error getting chat list: ${error.message}`);
            throw error;
        }
    }

    // อัปโหลดไฟล์เพื่อส่งให้ user
    @Post('upload-file/:chatAccountId/:userId')
    @UseInterceptors(
        FileInterceptor('file', {
            storage: diskStorage({
                destination: './uploads',
                filename: (req, file, callback) => {
                    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
                    const ext = extname(file.originalname);
                    callback(null, `${uniqueSuffix}${ext}`);
                },
            }),
            limits: {
                fileSize: 10 * 1024 * 1024, // 10MB
            },
        }),
    )
    async uploadFile(
        @Param('chatAccountId') chatAccountId: string,
        @Param('userId') userId: string,
        @UploadedFile() file: Express.Multer.File,
        @Body('platform') platform: 'facebook' | 'instagram' = 'facebook',
        @Body('caption') caption?: string,
    ): Promise<{ success: boolean; messageId?: string }> {
        try {
            if (!file) {
                throw new Error('File not founded');
            }

            const result = await this.metaService.sendFile(userId, file, chatAccountId, platform, caption);
            return { success: true, messageId: result?.messageId };
        } catch (error) {
            this.logger.error(`Error uploading file: ${error.message}`);
            throw error;
        }
    }
}
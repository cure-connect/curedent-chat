"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var MetaController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetaController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const path_1 = require("path");
const meta_service_1 = require("./meta.service");
const chat_account_service_1 = require("../chat/chat-account.service");
let MetaController = MetaController_1 = class MetaController {
    metaService;
    chatAccountService;
    logger = new common_1.Logger(MetaController_1.name);
    constructor(metaService, chatAccountService) {
        this.metaService = metaService;
        this.chatAccountService = chatAccountService;
    }
    async verifyWebhookWithAccount(chatAccountId, mode, verifyToken, challenge) {
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
        }
        catch (error) {
            this.logger.error(`Error verifying webhook: ${error.message}`);
            return 'Error verifying webhook';
        }
    }
    verifyWebhook(query) {
        const VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN || '';
        if (query['hub.mode'] === 'subscribe' && query['hub.verify_token'] === VERIFY_TOKEN) {
            this.logger.log('Webhook verified with default token');
            return query['hub.challenge'];
        }
        this.logger.warn('Invalid verify token for default webhook');
        return 'Invalid verify token';
    }
    async handleWebhookWithAccount(chatAccountId, body, signature) {
        try {
            const chatAccount = await this.chatAccountService.findByChannelId(chatAccountId);
            if (!chatAccount) {
                this.logger.warn(`Invalid chatAccountId: ${chatAccountId}`);
                return 'Invalid chatAccountId';
            }
            if (signature && chatAccount.secret) {
                const isValid = await this.metaService.validateSignature(JSON.stringify(body), chatAccount.secret, signature);
                if (!isValid) {
                    this.logger.warn(`Invalid signature for chatAccountId: ${chatAccountId}`);
                    return 'Invalid signature';
                }
            }
            await this.metaService.handleWebhook(body, chatAccount);
            return 'EVENT_RECEIVED';
        }
        catch (error) {
            this.logger.error(`Error handling webhook: ${error.message}`);
            return 'Error processing webhook';
        }
    }
    async handleWebhook(body) {
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
        }
        catch (error) {
            this.logger.error(`Error handling webhook: ${error.message}`);
            return 'Error processing webhook';
        }
    }
    async sendMessage(chatAccountId, userId, message, platform = 'facebook') {
        try {
            const result = await this.metaService.pushMessage(userId, message, chatAccountId, platform);
            return { success: true, messageId: result?.messageId };
        }
        catch (error) {
            this.logger.error(`Error sending message: ${error.message}`);
            throw error;
        }
    }
    async sendTemplate(chatAccountId, userId, template, platform = 'facebook') {
        try {
            const result = await this.metaService.sendTemplateMessage(userId, template, chatAccountId, platform);
            return { success: true, messageId: result?.messageId };
        }
        catch (error) {
            this.logger.error(`Error sending template: ${error.message}`);
            throw error;
        }
    }
    async getMessageHistory(chatAccountId, userId, limit = 50, before, after) {
        try {
            return this.metaService.getUserMessageHistory(chatAccountId, userId, limit, before, after);
        }
        catch (error) {
            this.logger.error(`Error getting message history: ${error.message}`);
            throw error;
        }
    }
    async getUserProfile(chatAccountId, userId, platform = 'facebook') {
        try {
            return this.metaService.getUserProfile(userId, chatAccountId, platform);
        }
        catch (error) {
            this.logger.error(`Error getting user profile: ${error.message}`);
            throw error;
        }
    }
    async getChatList(chatAccountId, platform, limit = 20) {
        try {
            return this.metaService.getChatList(chatAccountId, platform, limit);
        }
        catch (error) {
            this.logger.error(`Error getting chat list: ${error.message}`);
            throw error;
        }
    }
    async uploadFile(chatAccountId, userId, file, platform = 'facebook', caption) {
        try {
            if (!file) {
                throw new Error('File not founded');
            }
            const result = await this.metaService.sendFile(userId, file, chatAccountId, platform, caption);
            return { success: true, messageId: result?.messageId };
        }
        catch (error) {
            this.logger.error(`Error uploading file: ${error.message}`);
            throw error;
        }
    }
};
exports.MetaController = MetaController;
__decorate([
    (0, common_1.Get)('webhook/:chatAccountId'),
    __param(0, (0, common_1.Param)('chatAccountId')),
    __param(1, (0, common_1.Query)('hub.mode')),
    __param(2, (0, common_1.Query)('hub.verify_token')),
    __param(3, (0, common_1.Query)('hub.challenge')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], MetaController.prototype, "verifyWebhookWithAccount", null);
__decorate([
    (0, common_1.Get)('webhook'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", String)
], MetaController.prototype, "verifyWebhook", null);
__decorate([
    (0, common_1.Post)('webhook/:chatAccountId'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('chatAccountId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('x-hub-signature-256')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], MetaController.prototype, "handleWebhookWithAccount", null);
__decorate([
    (0, common_1.Post)('webhook'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MetaController.prototype, "handleWebhook", null);
__decorate([
    (0, common_1.Post)('send/:chatAccountId/:userId'),
    __param(0, (0, common_1.Param)('chatAccountId')),
    __param(1, (0, common_1.Param)('userId')),
    __param(2, (0, common_1.Body)('message')),
    __param(3, (0, common_1.Body)('platform')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], MetaController.prototype, "sendMessage", null);
__decorate([
    (0, common_1.Post)('send-template/:chatAccountId/:userId'),
    __param(0, (0, common_1.Param)('chatAccountId')),
    __param(1, (0, common_1.Param)('userId')),
    __param(2, (0, common_1.Body)('template')),
    __param(3, (0, common_1.Body)('platform')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, String]),
    __metadata("design:returntype", Promise)
], MetaController.prototype, "sendTemplate", null);
__decorate([
    (0, common_1.Get)('history/:chatAccountId/:userId'),
    __param(0, (0, common_1.Param)('chatAccountId')),
    __param(1, (0, common_1.Param)('userId')),
    __param(2, (0, common_1.Query)('limit')),
    __param(3, (0, common_1.Query)('before')),
    __param(4, (0, common_1.Query)('after')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Number, String, String]),
    __metadata("design:returntype", Promise)
], MetaController.prototype, "getMessageHistory", null);
__decorate([
    (0, common_1.Get)('user/:chatAccountId/:userId'),
    __param(0, (0, common_1.Param)('chatAccountId')),
    __param(1, (0, common_1.Param)('userId')),
    __param(2, (0, common_1.Query)('platform')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], MetaController.prototype, "getUserProfile", null);
__decorate([
    (0, common_1.Get)('chat-list/:chatAccountId'),
    __param(0, (0, common_1.Param)('chatAccountId')),
    __param(1, (0, common_1.Query)('platform')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Number]),
    __metadata("design:returntype", Promise)
], MetaController.prototype, "getChatList", null);
__decorate([
    (0, common_1.Post)('upload-file/:chatAccountId/:userId'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.diskStorage)({
            destination: './uploads',
            filename: (req, file, callback) => {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
                const ext = (0, path_1.extname)(file.originalname);
                callback(null, `${uniqueSuffix}${ext}`);
            },
        }),
        limits: {
            fileSize: 10 * 1024 * 1024,
        },
    })),
    __param(0, (0, common_1.Param)('chatAccountId')),
    __param(1, (0, common_1.Param)('userId')),
    __param(2, (0, common_1.UploadedFile)()),
    __param(3, (0, common_1.Body)('platform')),
    __param(4, (0, common_1.Body)('caption')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, String, String]),
    __metadata("design:returntype", Promise)
], MetaController.prototype, "uploadFile", null);
exports.MetaController = MetaController = MetaController_1 = __decorate([
    (0, common_1.Controller)('meta'),
    __metadata("design:paramtypes", [meta_service_1.MetaService,
        chat_account_service_1.ChatAccountService])
], MetaController);
//# sourceMappingURL=meta.controller.js.map
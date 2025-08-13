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
Object.defineProperty(exports, "__esModule", { value: true });
exports.LineController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const path_1 = require("path");
const line_service_1 = require("./line.service");
const line = require("@line/bot-sdk");
const chat_account_service_1 = require("../chat/chat-account.service");
let LineController = class LineController {
    lineService;
    chatAccountService;
    constructor(lineService, chatAccountService) {
        this.lineService = lineService;
        this.chatAccountService = chatAccountService;
    }
    async handleWebhook(chatAccountId, body, signature) {
        const chatAccount = await this.chatAccountService.findByChannelId(chatAccountId);
        if (!chatAccount)
            throw new Error('Invalid chatAccountId');
        try {
            const isValid = line.validateSignature(JSON.stringify(body), chatAccount.secret, signature);
        }
        catch (error) {
            console.error('Error validating signature:', error);
        }
        await this.lineService.handleWebhook(body);
        return 'OK';
    }
    async sendMessage(chatAccountId, userId, message) {
        await this.lineService.pushMessage(userId, message, chatAccountId);
        return { success: true };
    }
    async getMessageHistory(chatAccountId, userId, limit) {
        return this.lineService.getUserMessageHistory(userId, limit || 50);
    }
    async getUserProfile(chatAccountId, userId) {
        return this.lineService.getUserProfile(userId, chatAccountId);
    }
    async getChatList(chatAccountId) {
        return this.lineService.getChatList(chatAccountId);
    }
    async uploadFile(chatAccountId, userId, file) {
        if (!file) {
            throw new Error('ไม่พบไฟล์ที่อัปโหลด');
        }
        await this.lineService.sendFile(userId, file, chatAccountId);
        return { success: true };
    }
};
exports.LineController = LineController;
__decorate([
    (0, common_1.Post)('webhook/:chatAccountId'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('chatAccountId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('x-line-signature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], LineController.prototype, "handleWebhook", null);
__decorate([
    (0, common_1.Post)('send/:chatAccountId/:userId'),
    __param(0, (0, common_1.Param)('chatAccountId')),
    __param(1, (0, common_1.Param)('userId')),
    __param(2, (0, common_1.Body)('message')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], LineController.prototype, "sendMessage", null);
__decorate([
    (0, common_1.Get)('history/:chatAccountId/:userId'),
    __param(0, (0, common_1.Param)('chatAccountId')),
    __param(1, (0, common_1.Param)('userId')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Number]),
    __metadata("design:returntype", Promise)
], LineController.prototype, "getMessageHistory", null);
__decorate([
    (0, common_1.Get)('user/:chatAccountId/:userId'),
    __param(0, (0, common_1.Param)('chatAccountId')),
    __param(1, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], LineController.prototype, "getUserProfile", null);
__decorate([
    (0, common_1.Get)('chat-list/:chatAccountId'),
    __param(0, (0, common_1.Param)('chatAccountId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], LineController.prototype, "getChatList", null);
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
            fileSize: 5 * 1024 * 1024,
        },
    })),
    __param(0, (0, common_1.Param)('chatAccountId')),
    __param(1, (0, common_1.Param)('userId')),
    __param(2, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], LineController.prototype, "uploadFile", null);
exports.LineController = LineController = __decorate([
    (0, common_1.Controller)('line'),
    __metadata("design:paramtypes", [line_service_1.LineService,
        chat_account_service_1.ChatAccountService])
], LineController);
//# sourceMappingURL=line.controller.js.map
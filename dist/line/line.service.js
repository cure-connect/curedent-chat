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
var LineService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LineService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const bot_sdk_1 = require("@line/bot-sdk");
const chat_message_schema_1 = require("../chat/schemas/chat-message.schema");
const chat_account_schema_1 = require("../chat/schemas/chat-account.schema");
const chat_gateway_1 = require("../chat/chat.gateway");
let LineService = LineService_1 = class LineService {
    chatMessageModel;
    chatAccountModel;
    chatGateway;
    logger = new common_1.Logger(LineService_1.name);
    constructor(chatMessageModel, chatAccountModel, chatGateway) {
        this.chatMessageModel = chatMessageModel;
        this.chatAccountModel = chatAccountModel;
        this.chatGateway = chatGateway;
    }
    async handleWebhook(body) {
        const channelId = body.destination;
        const chatAccount = await this.chatAccountModel
            .findOne({ platform: 'line', channelId })
            .exec();
        if (!chatAccount) {
            this.logger.warn(`ไม่พบ ChatAccount สำหรับ channelId: ${channelId}`);
            return;
        }
        const chatAccountId = chatAccount._id.toString();
        const client = new bot_sdk_1.Client({ channelAccessToken: chatAccount.accessToken });
        const events = body.events;
        for (const event of events) {
            this.logger.log(`Line Webhook Event: ${JSON.stringify(event)}`);
            if (event.type === 'message') {
                switch (event.message.type) {
                    case 'text':
                        await this.handleTextMessage(event, client, chatAccountId);
                        break;
                    case 'sticker':
                        await this.handleStickerMessage(event, client, chatAccountId);
                        break;
                    case 'image':
                    case 'video':
                    case 'audio':
                    case 'file':
                        await this.handleFileMessage(event, client, chatAccountId);
                        break;
                    default:
                        this.logger.log(`Not supported: ${event.message.type}`);
                }
            }
        }
    }
    async handleStickerMessage(event, client, chatAccountId) {
        if (event.message.type !== 'sticker')
            return;
        const userId = event.source.userId;
        if (!userId)
            return;
        const stickerMessage = event.message;
        const message = await this.saveMessage({
            chatAccountId,
            senderId: userId,
            text: '[สติกเกอร์]',
            messageType: 'sticker',
            timestamp: new Date(event.timestamp),
            source: 'user',
            stickerId: stickerMessage.stickerId,
            packageId: stickerMessage.packageId
        });
        this.chatGateway.sendMessageToClient(chatAccountId, userId, message);
    }
    async handleFileMessage(event, client, chatAccountId) {
        const userId = event.source.userId;
        if (!userId)
            return;
        const messageType = event.message.type;
        const messageId = event.message.id;
        try {
            let fileName = 'ไฟล์จาก LINE';
            let fileDescription = '';
            switch (messageType) {
                case 'image':
                    fileName = 'รูปภาพจาก LINE';
                    fileDescription = 'รูปภาพ';
                    break;
                case 'video':
                    fileName = 'วิดีโอจาก LINE';
                    fileDescription = 'วิดีโอ';
                    break;
                case 'audio':
                    fileName = 'เสียงจาก LINE';
                    fileDescription = 'ไฟล์เสียง';
                    break;
                case 'file':
                    fileName = 'ไฟล์จาก LINE';
                    fileDescription = 'ไฟล์';
                    break;
            }
            const message = await this.saveMessage({
                chatAccountId,
                senderId: userId,
                text: `[${fileDescription}] - LINE ไม่อนุญาตให้ดาวน์โหลดไฟล์โดยตรง กรุณาติดต่อผู้ใช้เพื่อขอไฟล์อีกครั้ง`,
                messageType: 'text',
                timestamp: new Date(event.timestamp),
                source: 'user'
            });
            this.chatGateway.sendMessageToClient(chatAccountId, userId, message);
        }
        catch (error) {
            this.logger.error(`Error handling file message: ${error.message}`);
            const errorMessage = await this.saveMessage({
                chatAccountId,
                senderId: userId,
                text: `[ไฟล์] - ไม่สามารถดาวน์โหลดได้ กรุณาติดต่อผู้ใช้เพื่อขอไฟล์อีกครั้ง`,
                messageType: 'text',
                timestamp: new Date(event.timestamp),
                source: 'user'
            });
            this.chatGateway.sendMessageToClient(chatAccountId, userId, errorMessage);
        }
    }
    async handleImageMessage(event, client, chatAccountId) {
        if (event.message.type !== 'image')
            return;
        const userId = event.source.userId;
        if (!userId)
            return;
        try {
            const message = await this.saveMessage({
                chatAccountId,
                senderId: userId,
                text: '[รูปภาพ] - LINE ไม่อนุญาตให้ดาวน์โหลดรูปภาพโดยตรง',
                messageType: 'file',
                timestamp: new Date(event.timestamp),
                source: 'user',
                fileName: 'รูปภาพจาก LINE',
                fileType: 'image/jpeg'
            });
            this.chatGateway.sendMessageToClient(chatAccountId, userId, message);
        }
        catch (error) {
            this.logger.error(`Error handling image message: ${error.message}`);
        }
    }
    async sendFile(userId, file, chatAccountId) {
        const chatAccount = await this.chatAccountModel.findById(chatAccountId);
        if (!chatAccount)
            throw new Error('ไม่พบ ChatAccount ที่ระบุ');
        const client = new bot_sdk_1.Client({ channelAccessToken: chatAccount.accessToken });
        try {
            const fileUrl = `${process.env.API_BASE_URL}/uploads/${file.filename}`;
            const isImage = file.mimetype.startsWith('image/');
            const webhookBaseUrl = process.env.WEBHOOK_BASE_URL;
            if (isImage && webhookBaseUrl && webhookBaseUrl.startsWith('https://')) {
                const httpsFileUrl = `${webhookBaseUrl}/uploads/${file.filename}`;
                await client.pushMessage(userId, [{
                        type: 'image',
                        originalContentUrl: httpsFileUrl,
                        previewImageUrl: httpsFileUrl
                    }]);
            }
            else {
                const messageText = isImage
                    ? `[รูปภาพ] ดูได้ที่: ${fileUrl}\n\nหมายเหตุ: LINE API ต้องการ HTTPS URL สำหรับการแสดงภาพโดยตรง`
                    : `ส่งไฟล์: ${file.originalname}\nดาวน์โหลด: ${fileUrl}`;
                await client.pushMessage(userId, [{
                        type: 'text',
                        text: messageText
                    }]);
            }
            const message = await this.saveMessage({
                chatAccountId,
                senderId: userId,
                text: isImage ? '[รูปภาพ]' : `ส่งไฟล์: ${file.originalname}`,
                messageType: 'file',
                timestamp: new Date(),
                source: 'admin',
                fileName: file.originalname,
                fileUrl: fileUrl,
                fileSize: file.size,
                fileType: file.mimetype
            });
            this.chatGateway.sendMessageToClient(chatAccountId, userId, message);
        }
        catch (error) {
            this.logger.error(`Error sending file: ${error.message}`);
            throw error;
        }
    }
    async handleTextMessage(event, client, chatAccountId) {
        if (event.message.type !== 'text')
            return;
        const text = event.message.text;
        const userId = event.source.userId;
        if (!userId)
            return;
        const message = await this.saveMessage({
            chatAccountId,
            senderId: userId,
            text,
            messageType: 'text',
            timestamp: new Date(event.timestamp),
            source: 'user',
        });
        this.chatGateway.sendMessageToClient(chatAccountId, userId, message);
    }
    async pushMessage(userId, text, chatAccountId) {
        const chatAccount = await this.chatAccountModel.findById(chatAccountId);
        if (!chatAccount)
            throw new Error('ไม่พบ ChatAccount ที่ระบุ');
        const client = new bot_sdk_1.Client({ channelAccessToken: chatAccount.accessToken });
        await client.pushMessage(userId, [{ type: 'text', text }]);
        const message = await this.saveMessage({
            chatAccountId,
            senderId: userId,
            text,
            messageType: 'text',
            timestamp: new Date(),
            source: 'admin',
        });
        this.chatGateway.sendMessageToClient(chatAccountId, userId, message);
    }
    async saveMessage(data) {
        const doc = new this.chatMessageModel(data);
        return doc.save();
    }
    async getUserMessageHistory(userId, limit = 50) {
        return this.chatMessageModel.find({ senderId: userId })
            .sort({ timestamp: 1 })
            .limit(limit)
            .exec();
    }
    async getUserProfile(userId, chatAccountId) {
        const chatAccount = await this.chatAccountModel.findById(chatAccountId);
        if (!chatAccount)
            throw new Error('ไม่พบ ChatAccount ที่ระบุ');
        const client = new bot_sdk_1.Client({ channelAccessToken: chatAccount.accessToken });
        return client.getProfile(userId);
    }
    async getChatList(chatAccountId) {
        const list = await this.chatMessageModel.aggregate([
            {
                $match: {
                    chatAccountId,
                },
            },
            { $sort: { timestamp: -1 } },
            {
                $group: {
                    _id: '$senderId',
                    lastMessage: { $first: '$text' },
                    timestamp: { $first: '$timestamp' },
                },
            },
            {
                $project: {
                    senderId: '$_id',
                    userId: '$_id',
                    lastMessage: 1,
                    timestamp: 1,
                    _id: 0,
                },
            },
            { $sort: { timestamp: -1 } },
        ]);
        const chatAccount = await this.chatAccountModel.findById(chatAccountId);
        if (!chatAccount)
            throw new Error('ไม่พบ ChatAccount');
        const client = new bot_sdk_1.Client({ channelAccessToken: chatAccount.accessToken });
        const enrichedList = await Promise.all(list.map(async (chat) => {
            try {
                const profile = await client.getProfile(chat.senderId);
                return {
                    ...chat,
                    displayName: profile.displayName,
                    pictureUrl: profile.pictureUrl,
                };
            }
            catch (error) {
                return {
                    ...chat,
                    displayName: 'Unknown',
                    pictureUrl: null,
                };
            }
        }));
        return enrichedList;
    }
};
exports.LineService = LineService;
exports.LineService = LineService = LineService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(chat_message_schema_1.ChatMessage.name)),
    __param(1, (0, mongoose_1.InjectModel)(chat_account_schema_1.ChatAccount.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        chat_gateway_1.ChatGateway])
], LineService);
//# sourceMappingURL=line.service.js.map
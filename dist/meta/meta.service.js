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
var MetaService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetaService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const crypto = require("crypto");
const axios_1 = require("axios");
const chat_message_schema_1 = require("../chat/schemas/chat-message.schema");
const chat_account_schema_1 = require("../chat/schemas/chat-account.schema");
const chat_contact_schema_1 = require("../chat/schemas/chat-contact.schema");
const chat_gateway_1 = require("../chat/chat.gateway");
let MetaService = MetaService_1 = class MetaService {
    chatMessageModel;
    chatAccountModel;
    chatContactModel;
    chatGateway;
    logger = new common_1.Logger(MetaService_1.name);
    META_API_VERSION = 'v22.0';
    DEFAULT_PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN || '';
    constructor(chatMessageModel, chatAccountModel, chatContactModel, chatGateway) {
        this.chatMessageModel = chatMessageModel;
        this.chatAccountModel = chatAccountModel;
        this.chatContactModel = chatContactModel;
        this.chatGateway = chatGateway;
    }
    async validateSignature(payload, appSecret, signature) {
        try {
            const expectedSignature = crypto
                .createHmac('sha256', appSecret)
                .update(payload)
                .digest('hex');
            return `sha256=${expectedSignature}` === signature;
        }
        catch (error) {
            this.logger.error(`Error validating signature: ${error.message}`);
            return false;
        }
    }
    async sendTextMessage(senderId, text) {
        const url = `https://graph.facebook.com/${this.META_API_VERSION}/me/messages?access_token=${this.DEFAULT_PAGE_ACCESS_TOKEN}`;
        const body = {
            recipient: { id: senderId },
            message: { text },
        };
        try {
            const response = await axios_1.default.post(url, body);
            this.logger.log(`Message sent to ${senderId}: ${text.substring(0, 30)}...`);
            const chatAccount = await this.chatAccountModel.findOne({
                platform: 'facebook',
                accessToken: this.DEFAULT_PAGE_ACCESS_TOKEN
            });
            if (chatAccount) {
                const chatAccountId = chatAccount._id.toString();
                await this.saveMessage({
                    chatAccountId,
                    senderId,
                    text,
                    messageType: 'text',
                    timestamp: new Date(),
                    source: 'admin',
                    messageId: response.data.message_id || ''
                });
            }
            else {
                this.logger.warn(`Cannot find chatAccount for default page access token`);
            }
            return response.data;
        }
        catch (error) {
            this.logger.error(`Failed to send message: ${error.response?.data?.error?.message || error.message}`);
            throw error;
        }
    }
    async handleWebhook(body, chatAccount) {
        const chatAccountId = chatAccount._id.toString();
        try {
            if (body.object === 'page' || body.object === 'instagram') {
                const entries = body.entry || [];
                for (const entry of entries) {
                    const messaging = entry.messaging || [];
                    for (const event of messaging) {
                        this.logger.debug(`Meta Webhook Event: ${JSON.stringify(event)}`);
                        if (event.message) {
                            await this.handleMessageEvent(event, chatAccountId, chatAccount.platform);
                        }
                        else if (event.postback) {
                            await this.handlePostbackEvent(event, chatAccountId, chatAccount.platform);
                        }
                        else if (event.reaction) {
                            await this.handleReactionEvent(event, chatAccountId, chatAccount.platform);
                        }
                        else if (event.read) {
                            await this.handleReadEvent(event, chatAccountId, chatAccount.platform);
                        }
                    }
                    if (body.object === 'instagram') {
                        const changes = entry.changes || [];
                        for (const change of changes) {
                            if (change.field === 'messages') {
                                const messaging = change.value.messages || [];
                                for (const message of messaging) {
                                    const igEvent = {
                                        sender: { id: message.from.id },
                                        recipient: { id: change.value.id },
                                        timestamp: message.timestamp,
                                        message: {
                                            text: message.text,
                                            attachments: message.attachments,
                                        },
                                    };
                                    await this.handleMessageEvent(igEvent, chatAccountId, 'instagram');
                                }
                            }
                        }
                    }
                }
            }
        }
        catch (error) {
            this.logger.error(`Error handling webhook: ${error.message}`);
        }
    }
    async handleMessageEvent(event, chatAccountId, platform) {
        const senderId = event.sender.id;
        const recipientId = event.recipient.id;
        try {
            await this.updateContactInfo(chatAccountId, senderId, platform);
            if (event.message.text) {
                const message = await this.saveMessage({
                    chatAccountId,
                    senderId,
                    text: event.message.text,
                    messageType: 'text',
                    timestamp: new Date(event.timestamp),
                    source: 'user',
                    messageId: event.message.mid || '',
                });
                this.chatGateway.sendMessageToClient(chatAccountId, senderId, message);
            }
            else if (event.message.attachments) {
                for (const attachment of event.message.attachments) {
                    const messageType = this.getMessageTypeFromAttachment(attachment.type);
                    const message = await this.saveMessage({
                        chatAccountId,
                        senderId,
                        text: `[${this.getAttachmentLabel(attachment.type)}]`,
                        messageType,
                        timestamp: new Date(event.timestamp),
                        source: 'user',
                        fileUrl: attachment.payload?.url || null,
                        messageId: event.message.mid || '',
                    });
                    this.chatGateway.sendMessageToClient(chatAccountId, senderId, message);
                }
            }
        }
        catch (error) {
            this.logger.error(`Error handling message event: ${error.message}`);
        }
    }
    async handlePostbackEvent(event, chatAccountId, platform) {
        const senderId = event.sender.id;
        const postbackData = event.postback.payload;
        try {
            await this.updateContactInfo(chatAccountId, senderId, platform);
            const message = await this.saveMessage({
                chatAccountId,
                senderId,
                text: `[POSTBACK] ${postbackData}`,
                messageType: 'text',
                timestamp: new Date(event.timestamp),
                source: 'user',
                messageId: event.postback.mid || '',
            });
            this.chatGateway.sendMessageToClient(chatAccountId, senderId, message);
        }
        catch (error) {
            this.logger.error(`Error handling postback event: ${error.message}`);
        }
    }
    async handleReactionEvent(event, chatAccountId, platform) {
        const senderId = event.sender.id;
        const reaction = event.reaction.reaction;
        const messageId = event.reaction.mid;
        try {
            await this.updateContactInfo(chatAccountId, senderId, platform);
            const message = await this.saveMessage({
                chatAccountId,
                senderId,
                text: `[REACTION] ${reaction} to message ${messageId}`,
                messageType: 'text',
                timestamp: new Date(event.timestamp),
                source: 'user',
            });
            this.chatGateway.sendMessageToClient(chatAccountId, senderId, message);
        }
        catch (error) {
            this.logger.error(`Error handling reaction event: ${error.message}`);
        }
    }
    async handleReadEvent(event, chatAccountId, platform) {
        this.logger.debug(`Read event from ${event.sender.id} at ${new Date(event.timestamp)}`);
    }
    async updateContactInfo(chatAccountId, senderId, platform) {
        try {
            if (!chatAccountId || typeof chatAccountId !== 'string' || !this.isValidObjectId(chatAccountId)) {
                this.logger.warn(`Invalid chatAccountId format: ${chatAccountId}`);
                return;
            }
            let contact = await this.chatContactModel.findOne({
                chatAccountId,
                senderId,
            });
            if (contact) {
                contact.lastMessageAt = new Date();
                await contact.save();
            }
            else {
                try {
                    const chatAccount = await this.chatAccountModel.findById(chatAccountId);
                    if (chatAccount) {
                        try {
                            const profile = await this.getUserProfile(senderId, chatAccountId, platform);
                            contact = new this.chatContactModel({
                                chatAccountId,
                                senderId,
                                displayName: profile.name || profile.username || `User ${senderId}`,
                                pictureUrl: profile.profile_pic || profile.profile_picture_url,
                                lastMessageAt: new Date(),
                            });
                            await contact.save();
                        }
                        catch (error) {
                            contact = new this.chatContactModel({
                                chatAccountId,
                                senderId,
                                displayName: `User ${senderId}`,
                                lastMessageAt: new Date(),
                            });
                            await contact.save();
                        }
                    }
                }
                catch (error) {
                    this.logger.error(`Error finding chat account: ${error.message}`);
                }
            }
        }
        catch (error) {
            this.logger.error(`Error updating contact info: ${error.message}`);
        }
    }
    async pushMessage(userId, text, chatAccountId, platform = 'facebook') {
        const chatAccount = await this.chatAccountModel.findById(chatAccountId);
        if (!chatAccount)
            throw new Error('ไม่พบ ChatAccount ที่ระบุ');
        try {
            const pageId = chatAccount.channelId;
            const accessToken = chatAccount.accessToken || this.DEFAULT_PAGE_ACCESS_TOKEN;
            const url = `https://graph.facebook.com/${this.META_API_VERSION}/me/messages`;
            const payload = {
                recipient: { id: userId },
                message: { text },
                messaging_type: 'RESPONSE',
            };
            const response = await axios_1.default.post(url, payload, {
                params: {
                    access_token: accessToken,
                },
            });
            const message = await this.saveMessage({
                chatAccountId,
                senderId: userId,
                messageId: response.data.message_id,
                text,
                messageType: 'text',
                timestamp: new Date(),
                source: 'admin',
            });
            this.chatGateway.sendMessageToClient(chatAccountId, userId, message);
            return {
                messageId: response.data.message_id,
                recipientId: response.data.recipient_id,
            };
        }
        catch (error) {
            this.logger.error(`Error sending message: ${error.response?.data?.error?.message || error.message}`);
            throw error;
        }
    }
    async sendTemplateMessage(userId, template, chatAccountId, platform = 'facebook') {
        const chatAccount = await this.chatAccountModel.findById(chatAccountId);
        if (!chatAccount)
            throw new Error('ไม่พบ ChatAccount ที่ระบุ');
        try {
            const accessToken = chatAccount.accessToken || this.DEFAULT_PAGE_ACCESS_TOKEN;
            const url = `https://graph.facebook.com/${this.META_API_VERSION}/me/messages`;
            const payload = {
                recipient: { id: userId },
                message: {
                    attachment: template,
                },
                messaging_type: 'RESPONSE',
            };
            const response = await axios_1.default.post(url, payload, {
                params: {
                    access_token: accessToken,
                },
            });
            const templateText = this.getTemplateDescription(template);
            const message = await this.saveMessage({
                chatAccountId,
                senderId: userId,
                messageId: response.data.message_id,
                text: `[TEMPLATE] ${templateText}`,
                messageType: 'flex',
                timestamp: new Date(),
                source: 'admin',
            });
            this.chatGateway.sendMessageToClient(chatAccountId, userId, message);
            return {
                messageId: response.data.message_id,
                recipientId: response.data.recipient_id,
            };
        }
        catch (error) {
            this.logger.error(`Error sending template: ${error.response?.data?.error?.message || error.message}`);
            throw error;
        }
    }
    async sendFile(userId, file, chatAccountId, platform = 'facebook', caption) {
        const chatAccount = await this.chatAccountModel.findById(chatAccountId);
        if (!chatAccount)
            throw new Error('ไม่พบ ChatAccount ที่ระบุ');
        try {
            const accessToken = chatAccount.accessToken || this.DEFAULT_PAGE_ACCESS_TOKEN;
            const url = `https://graph.facebook.com/${this.META_API_VERSION}/me/messages`;
            const baseUrl = process.env.WEBHOOK_BASE_URL || '';
            const fileUrl = `${baseUrl}/uploads/${file.filename}`;
            const isImage = file.mimetype.startsWith('image/');
            const isVideo = file.mimetype.startsWith('video/');
            const isAudio = file.mimetype.startsWith('audio/');
            let attachmentType = 'file';
            if (isImage)
                attachmentType = 'image';
            if (isVideo)
                attachmentType = 'video';
            if (isAudio)
                attachmentType = 'audio';
            if (caption && platform === 'facebook' && (isImage || isVideo)) {
                await axios_1.default.post(url, {
                    recipient: { id: userId },
                    message: { text: caption },
                    messaging_type: 'RESPONSE',
                }, {
                    params: {
                        access_token: accessToken,
                    },
                });
            }
            const payload = {
                recipient: { id: userId },
                message: {
                    attachment: {
                        type: attachmentType,
                        payload: {
                            url: fileUrl,
                            is_reusable: true,
                        },
                    },
                },
                messaging_type: 'RESPONSE',
            };
            const response = await axios_1.default.post(url, payload, {
                params: {
                    access_token: accessToken,
                },
            });
            let displayText = isImage ? '[image]' : `[file] ${file.originalname}`;
            if (caption) {
                displayText += ` - ${caption}`;
            }
            const message = await this.saveMessage({
                chatAccountId,
                senderId: userId,
                messageId: response.data.message_id,
                text: displayText,
                messageType: this.getMessageTypeFromAttachment(attachmentType),
                timestamp: new Date(),
                source: 'admin',
                fileName: file.originalname,
                fileUrl: fileUrl,
                fileSize: file.size,
                fileType: file.mimetype,
            });
            this.chatGateway.sendMessageToClient(chatAccountId, userId, message);
            return {
                messageId: response.data.message_id,
                recipientId: response.data.recipient_id,
                fileUrl: fileUrl,
            };
        }
        catch (error) {
            this.logger.error(`Error sending file: ${error.response?.data?.error?.message || error.message}`);
            throw error;
        }
    }
    async saveMessage(data) {
        const doc = new this.chatMessageModel(data);
        return doc.save();
    }
    async getUserMessageHistory(chatAccountId, userId, limit = 50, before, after) {
        const query = { chatAccountId, senderId: userId };
        if (before || after) {
            query.timestamp = {};
            if (before) {
                query.timestamp.$lt = new Date(before);
            }
            if (after) {
                query.timestamp.$gt = new Date(after);
            }
        }
        return this.chatMessageModel
            .find(query)
            .sort({ timestamp: 1 })
            .limit(limit)
            .exec();
    }
    async getUserProfile(userId, chatAccountId, platform) {
        const chatAccount = await this.chatAccountModel.findById(chatAccountId);
        if (!chatAccount)
            throw new Error('ไม่พบ ChatAccount ที่ระบุ');
        try {
            const accessToken = chatAccount.accessToken || this.DEFAULT_PAGE_ACCESS_TOKEN;
            let url;
            let fields;
            if (platform === 'facebook') {
                url = `https://graph.facebook.com/${this.META_API_VERSION}/${userId}`;
                fields = 'name,profile_pic';
            }
            else {
                url = `https://graph.facebook.com/${this.META_API_VERSION}/${userId}`;
                fields = 'username,profile_picture_url';
            }
            const response = await axios_1.default.get(url, {
                params: {
                    fields,
                    access_token: accessToken,
                },
            });
            return response.data;
        }
        catch (error) {
            this.logger.error(`Error getting user profile: ${error.response?.data?.error?.message || error.message}`);
            throw error;
        }
    }
    async getChatList(chatAccountId, platform, limit = 20) {
        try {
            let query = { chatAccountId };
            if (platform) {
                const chatAccount = await this.chatAccountModel.findById(chatAccountId);
                if (chatAccount?.platform !== platform) {
                    return [];
                }
            }
            const conversations = await this.chatMessageModel.aggregate([
                { $match: query },
                { $sort: { timestamp: -1 } },
                {
                    $group: {
                        _id: '$senderId',
                        lastMessage: { $first: '$text' },
                        timestamp: { $first: '$timestamp' },
                        messageType: { $first: '$messageType' },
                    },
                },
                {
                    $lookup: {
                        from: 'chatcontacts',
                        localField: '_id',
                        foreignField: 'senderId',
                        as: 'contactInfo',
                    },
                },
                { $unwind: { path: '$contactInfo', preserveNullAndEmptyArrays: true } },
                {
                    $project: {
                        _id: 0,
                        senderId: '$_id',
                        lastMessage: 1,
                        timestamp: 1,
                        messageType: 1,
                        displayName: { $ifNull: ['$contactInfo.displayName', '$_id'] },
                        pictureUrl: '$contactInfo.pictureUrl',
                    },
                },
                { $sort: { timestamp: -1 } },
                { $limit: limit },
            ]);
            const result = await Promise.all(conversations.map(async (conversation) => {
                if (!conversation.pictureUrl || conversation.displayName === conversation.senderId) {
                    try {
                        const chatAccount = await this.chatAccountModel.findById(chatAccountId);
                        if (chatAccount) {
                            const profile = await this.getUserProfile(conversation.senderId, chatAccountId, platform || chatAccount.platform);
                            await this.chatContactModel.updateOne({ chatAccountId, senderId: conversation.senderId }, {
                                $set: {
                                    displayName: profile.name || profile.username || `User ${conversation.senderId}`,
                                    pictureUrl: profile.profile_pic || profile.profile_picture_url,
                                },
                            }, { upsert: true });
                            conversation.displayName = profile.name || profile.username || conversation.displayName;
                            conversation.pictureUrl = profile.profile_pic || profile.profile_picture_url || conversation.pictureUrl;
                        }
                    }
                    catch (error) {
                        this.logger.warn(`Could not fetch profile for ${conversation.senderId}: ${error.message}`);
                    }
                }
                return conversation;
            }));
            return result;
        }
        catch (error) {
            this.logger.error(`Error getting chat list: ${error.message}`);
            throw error;
        }
    }
    getMessageTypeFromAttachment(attachmentType) {
        switch (attachmentType) {
            case 'image':
                return 'image';
            case 'video':
                return 'video';
            case 'audio':
                return 'file';
            case 'file':
                return 'file';
            default:
                return 'text';
        }
    }
    getAttachmentLabel(attachmentType) {
        switch (attachmentType) {
            case 'image':
                return 'รูปภาพ';
            case 'video':
                return 'วิดีโอ';
            case 'audio':
                return 'เสียง';
            case 'file':
                return 'ไฟล์';
            default:
                return 'สื่อ';
        }
    }
    getTemplateDescription(template) {
        try {
            if (template.type === 'template' && template.payload.template_type === 'button') {
                return `ข้อความพร้อมปุ่ม: ${template.payload.text} (${template.payload.buttons.length} ปุ่ม)`;
            }
            else if (template.type === 'template' && template.payload.template_type === 'generic') {
                return `การ์ด ${template.payload.elements.length} รายการ`;
            }
            else if (template.type === 'template' && template.payload.template_type === 'media') {
                return `สื่อพร้อมปุ่ม: ${template.payload.elements[0].buttons.length} ปุ่ม`;
            }
            else {
                return `เทมเพลตประเภท: ${template.type}`;
            }
        }
        catch (error) {
            return 'เทมเพลต';
        }
    }
    isValidObjectId(id) {
        try {
            const ObjectId = require('mongoose').Types.ObjectId;
            return ObjectId.isValid(id);
        }
        catch (error) {
            return false;
        }
    }
};
exports.MetaService = MetaService;
exports.MetaService = MetaService = MetaService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(chat_message_schema_1.ChatMessage.name)),
    __param(1, (0, mongoose_1.InjectModel)(chat_account_schema_1.ChatAccount.name)),
    __param(2, (0, mongoose_1.InjectModel)(chat_contact_schema_1.ChatContact.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        chat_gateway_1.ChatGateway])
], MetaService);
//# sourceMappingURL=meta.service.js.map
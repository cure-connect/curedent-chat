import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import axios from 'axios';
import { ChatMessage, ChatMessageDocument } from '../chat/schemas/chat-message.schema';
import { ChatAccount, ChatAccountDocument } from '../chat/schemas/chat-account.schema';
import { ChatContact, ChatContactDocument } from '../chat/schemas/chat-contact.schema';
import { ChatGateway } from '../chat/chat.gateway';

@Injectable()
export class MetaService {
    private readonly logger = new Logger(MetaService.name);
    private readonly META_API_VERSION = 'v22.0';
    private readonly DEFAULT_PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN || '';

    constructor(
        @InjectModel(ChatMessage.name) private chatMessageModel: Model<ChatMessageDocument>,
        @InjectModel(ChatAccount.name) private chatAccountModel: Model<ChatAccountDocument>,
        @InjectModel(ChatContact.name) private chatContactModel: Model<ChatContactDocument>,
        private readonly chatGateway: ChatGateway,
    ) { }

    // ตรวจสอบ signature จาก webhook
    async validateSignature(
        payload: string,
        appSecret: string,
        signature: string
    ): Promise<boolean> {
        try {
            const expectedSignature = crypto
                .createHmac('sha256', appSecret)
                .update(payload)
                .digest('hex');

            return `sha256=${expectedSignature}` === signature;
        } catch (error) {
            this.logger.error(`Error validating signature: ${error.message}`);
            return false;
        }
    }

    // ส่งข้อความแบบง่ายไปยัง user (ใช้สำหรับตอบกลับอัตโนมัติ)
    async sendTextMessage(senderId: string, text: string): Promise<void> {
        const url = `https://graph.facebook.com/${this.META_API_VERSION}/me/messages?access_token=${this.DEFAULT_PAGE_ACCESS_TOKEN}`;
        const body = {
            recipient: { id: senderId },
            message: { text },
        };

        try {
            const response = await axios.post(url, body);
            this.logger.log(`Message sent to ${senderId}: ${text.substring(0, 30)}...`);

            // บันทึกข้อความลงฐานข้อมูล
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
            } else {
                this.logger.warn(`Cannot find chatAccount for default page access token`);
            }

            return response.data;
        } catch (error) {
            this.logger.error(`Failed to send message: ${error.response?.data?.error?.message || error.message}`);
            throw error;
        }
    }

    // จัดการกับ webhook events จาก Meta
    async handleWebhook(body: any, chatAccount: ChatAccount): Promise<void> {
        const chatAccountId = chatAccount._id.toString();

        try {
            // ตรวจสอบว่าเป็น Messenger หรือ Instagram
            if (body.object === 'page' || body.object === 'instagram') {
                const entries = body.entry || [];

                for (const entry of entries) {
                    // จัดการกับข้อความจาก Messenger
                    const messaging = entry.messaging || [];

                    for (const event of messaging) {
                        this.logger.debug(`Meta Webhook Event: ${JSON.stringify(event)}`);

                        if (event.message) {
                            await this.handleMessageEvent(event, chatAccountId, chatAccount.platform);
                        } else if (event.postback) {
                            await this.handlePostbackEvent(event, chatAccountId, chatAccount.platform);
                        } else if (event.reaction) {
                            await this.handleReactionEvent(event, chatAccountId, chatAccount.platform);
                        } else if (event.read) {
                            await this.handleReadEvent(event, chatAccountId, chatAccount.platform);
                        }
                    }

                    // จัดการกับข้อความจาก Instagram (มีโครงสร้างต่างจาก Messenger)
                    if (body.object === 'instagram') {
                        const changes = entry.changes || [];

                        for (const change of changes) {
                            if (change.field === 'messages') {
                                const messaging = change.value.messages || [];

                                for (const message of messaging) {
                                    // แปลงข้อมูลให้อยู่ในรูปแบบเดียวกับ Messenger เพื่อให้ใช้ฟังก์ชันเดียวกันได้
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
        } catch (error) {
            this.logger.error(`Error handling webhook: ${error.message}`);
        }
    }

    // จัดการกับข้อความที่ได้รับจาก user
    async handleMessageEvent(event: any, chatAccountId: string, platform: string): Promise<void> {
        const senderId = event.sender.id;
        const recipientId = event.recipient.id;

        try {
            // อัปเดตหรือสร้างข้อมูลผู้ติดต่อ
            await this.updateContactInfo(chatAccountId, senderId, platform);

            if (event.message.text) {
                // ข้อความปกติ
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
            } else if (event.message.attachments) {
                // ข้อความที่มีไฟล์แนบ (รูปภาพ, วิดีโอ, ฯลฯ)
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
        } catch (error) {
            this.logger.error(`Error handling message event: ${error.message}`);
        }
    }

    // จัดการกับ postback ที่ได้รับจาก user (เมื่อกดปุ่มหรือเมนู)
    async handlePostbackEvent(event: any, chatAccountId: string, platform: string): Promise<void> {
        const senderId = event.sender.id;
        const postbackData = event.postback.payload;

        try {
            // อัปเดตหรือสร้างข้อมูลผู้ติดต่อ
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
        } catch (error) {
            this.logger.error(`Error handling postback event: ${error.message}`);
        }
    }

    // จัดการกับ reaction (เช่น การกดถูกใจข้อความ)
    async handleReactionEvent(event: any, chatAccountId: string, platform: string): Promise<void> {
        const senderId = event.sender.id;
        const reaction = event.reaction.reaction;
        const messageId = event.reaction.mid;

        try {
            // อัปเดตหรือสร้างข้อมูลผู้ติดต่อ
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
        } catch (error) {
            this.logger.error(`Error handling reaction event: ${error.message}`);
        }
    }

    // จัดการกับเหตุการณ์อ่านข้อความ
    async handleReadEvent(event: any, chatAccountId: string, platform: string): Promise<void> {
        // ไม่จำเป็นต้องบันทึกลงฐานข้อมูล แต่อาจจะต้องอัปเดตสถานะการอ่านข้อความ
        this.logger.debug(`Read event from ${event.sender.id} at ${new Date(event.timestamp)}`);
    }

    // อัปเดตหรือสร้างข้อมูลผู้ติดต่อ
    async updateContactInfo(chatAccountId: string, senderId: string, platform: string): Promise<void> {
        try {
          // ตรวจสอบความถูกต้องของ chatAccountId (ป้องกันกรณี _id ไม่ใช่ ObjectId)
          if (!chatAccountId || typeof chatAccountId !== 'string' || !this.isValidObjectId(chatAccountId)) {
            this.logger.warn(`Invalid chatAccountId format: ${chatAccountId}`);
            return; // ออกจากฟังก์ชันหากไม่ถูกต้อง
          }
      
          // ตรวจสอบว่ามีข้อมูลผู้ติดต่อหรือไม่
          let contact = await this.chatContactModel.findOne({
            chatAccountId,
            senderId,
          });
          
          // อัปเดตเวลาการส่งข้อความล่าสุด
          if (contact) {
            contact.lastMessageAt = new Date();
            await contact.save();
          } else {
            // ถ้ายังไม่มี ให้สร้างใหม่
            try {
              const chatAccount = await this.chatAccountModel.findById(chatAccountId);
              
              if (chatAccount) {
                try {
                  // ดึงข้อมูลโปรไฟล์จาก Meta API
                  const profile = await this.getUserProfile(senderId, chatAccountId, platform as 'facebook' | 'instagram');
                  
                  // สร้างข้อมูลผู้ติดต่อใหม่
                  contact = new this.chatContactModel({
                    chatAccountId,
                    senderId,
                    displayName: profile.name || profile.username || `User ${senderId}`,
                    pictureUrl: profile.profile_pic || profile.profile_picture_url,
                    lastMessageAt: new Date(),
                  });
                  
                  await contact.save();
                } catch (error) {
                  // ถ้าไม่สามารถดึงข้อมูลโปรไฟล์ได้ ให้สร้างแบบมีข้อมูลขั้นต่ำ
                  contact = new this.chatContactModel({
                    chatAccountId,
                    senderId,
                    displayName: `User ${senderId}`,
                    lastMessageAt: new Date(),
                  });
                  
                  await contact.save();
                }
              }
            } catch (error) {
              this.logger.error(`Error finding chat account: ${error.message}`);
            }
          }
        } catch (error) {
          this.logger.error(`Error updating contact info: ${error.message}`);
        }
      }

    // ส่งข้อความไปยัง user ผ่าน Access Token ของแต่ละ chatAccount
    async pushMessage(
        userId: string,
        text: string,
        chatAccountId: string,
        platform: 'facebook' | 'instagram' = 'facebook'
    ): Promise<any> {
        const chatAccount = await this.chatAccountModel.findById(chatAccountId);
        if (!chatAccount) throw new Error('ไม่พบ ChatAccount ที่ระบุ');

        try {
            const pageId = chatAccount.channelId; // Page ID หรือ Instagram Business ID
            const accessToken = chatAccount.accessToken || this.DEFAULT_PAGE_ACCESS_TOKEN;

            // สร้าง URL สำหรับส่งข้อความ
            const url = `https://graph.facebook.com/${this.META_API_VERSION}/me/messages`;

            // สร้าง payload สำหรับส่งข้อความ
            const payload = {
                recipient: { id: userId },
                message: { text },
                messaging_type: 'RESPONSE',
            };

            // ส่งข้อความไปยัง Meta API
            const response = await axios.post(url, payload, {
                params: {
                    access_token: accessToken,
                },
            });

            // บันทึกข้อความลงฐานข้อมูล
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
        } catch (error) {
            this.logger.error(`Error sending message: ${error.response?.data?.error?.message || error.message}`);
            throw error;
        }
    }

    // ส่งข้อความแบบเทมเพลต (เช่น ปุ่ม, การ์ด, ฯลฯ)
    async sendTemplateMessage(
        userId: string,
        template: any,
        chatAccountId: string,
        platform: 'facebook' | 'instagram' = 'facebook'
    ): Promise<any> {
        const chatAccount = await this.chatAccountModel.findById(chatAccountId);
        if (!chatAccount) throw new Error('ไม่พบ ChatAccount ที่ระบุ');

        try {
            const accessToken = chatAccount.accessToken || this.DEFAULT_PAGE_ACCESS_TOKEN;

            // สร้าง URL สำหรับส่งข้อความ
            const url = `https://graph.facebook.com/${this.META_API_VERSION}/me/messages`;

            // สร้าง payload สำหรับส่งเทมเพลต
            const payload = {
                recipient: { id: userId },
                message: {
                    attachment: template,
                },
                messaging_type: 'RESPONSE',
            };

            // ส่งเทมเพลตไปยัง Meta API
            const response = await axios.post(url, payload, {
                params: {
                    access_token: accessToken,
                },
            });

            // บันทึกข้อความลงฐานข้อมูล
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
        } catch (error) {
            this.logger.error(`Error sending template: ${error.response?.data?.error?.message || error.message}`);
            throw error;
        }
    }

    // ส่งไฟล์ไปยัง user
    async sendFile(
        userId: string,
        file: Express.Multer.File,
        chatAccountId: string,
        platform: 'facebook' | 'instagram' = 'facebook',
        caption?: string
    ): Promise<any> {
        const chatAccount = await this.chatAccountModel.findById(chatAccountId);
        if (!chatAccount) throw new Error('ไม่พบ ChatAccount ที่ระบุ');

        try {
            const accessToken = chatAccount.accessToken || this.DEFAULT_PAGE_ACCESS_TOKEN;

            // สร้าง URL สำหรับส่งข้อความ
            const url = `https://graph.facebook.com/${this.META_API_VERSION}/me/messages`;

            // สร้าง URL ของไฟล์
            const baseUrl = process.env.WEBHOOK_BASE_URL || '';
            const fileUrl = `${baseUrl}/uploads/${file.filename}`;

            // ตรวจสอบประเภทของไฟล์
            const isImage = file.mimetype.startsWith('image/');
            const isVideo = file.mimetype.startsWith('video/');
            const isAudio = file.mimetype.startsWith('audio/');

            let attachmentType = 'file';

            if (isImage) attachmentType = 'image';
            if (isVideo) attachmentType = 'video';
            if (isAudio) attachmentType = 'audio';

            if (caption && platform === 'facebook' && (isImage || isVideo)) {
                await axios.post(url, {
                    recipient: { id: userId },
                    message: { text: caption },
                    messaging_type: 'RESPONSE',
                }, {
                    params: {
                        access_token: accessToken,
                    },
                });
            }

            // สร้าง payload สำหรับส่งไฟล์
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

            // ส่งไฟล์ไปยัง Meta API
            const response = await axios.post(url, payload, {
                params: {
                    access_token: accessToken,
                },
            });

            // บันทึกข้อความลงฐานข้อมูล
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
        } catch (error) {
            this.logger.error(`Error sending file: ${error.response?.data?.error?.message || error.message}`);
            throw error;
        }
    }

    // บันทึกข้อความลงฐานข้อมูล
    async saveMessage(data: Partial<ChatMessage>): Promise<ChatMessage> {
        const doc = new this.chatMessageModel(data);
        return doc.save();
    }

    // ดึงประวัติข้อความของ user
    async getUserMessageHistory(
        chatAccountId: string,
        userId: string,
        limit = 50,
        before?: string,
        after?: string
    ): Promise<ChatMessage[]> {
        const query: any = { chatAccountId, senderId: userId };

        // เพิ่มตัวกรองตามวันที่
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

    // ดึงข้อมูลโปรไฟล์ของ user
    async getUserProfile(
        userId: string,
        chatAccountId: string,
        platform: 'facebook' | 'instagram'
    ): Promise<any> {
        const chatAccount = await this.chatAccountModel.findById(chatAccountId);
        if (!chatAccount) throw new Error('ไม่พบ ChatAccount ที่ระบุ');

        try {
            const accessToken = chatAccount.accessToken || this.DEFAULT_PAGE_ACCESS_TOKEN;
            let url: string;
            let fields: string;

            if (platform === 'facebook') {
                url = `https://graph.facebook.com/${this.META_API_VERSION}/${userId}`;
                fields = 'name,profile_pic';
            } else { // Instagram
                url = `https://graph.facebook.com/${this.META_API_VERSION}/${userId}`;
                fields = 'username,profile_picture_url';
            }

            const response = await axios.get(url, {
                params: {
                    fields,
                    access_token: accessToken,
                },
            });

            return response.data;
        } catch (error) {
            this.logger.error(`Error getting user profile: ${error.response?.data?.error?.message || error.message}`);
            throw error;
        }
    }

    // ดึงรายการแชทล่าสุด
    async getChatList(
        chatAccountId: string,
        platform?: 'facebook' | 'instagram',
        limit: number = 20
    ): Promise<any[]> {
        try {
            let query: any = { chatAccountId };

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

            const result = await Promise.all(
                conversations.map(async (conversation) => {
                    if (!conversation.pictureUrl || conversation.displayName === conversation.senderId) {
                        try {
                            const chatAccount = await this.chatAccountModel.findById(chatAccountId);

                            if (chatAccount) {
                                const profile = await this.getUserProfile(
                                    conversation.senderId,
                                    chatAccountId,
                                    platform || chatAccount.platform as 'facebook' | 'instagram'
                                );

                                await this.chatContactModel.updateOne(
                                    { chatAccountId, senderId: conversation.senderId },
                                    {
                                        $set: {
                                            displayName: profile.name || profile.username || `User ${conversation.senderId}`,
                                            pictureUrl: profile.profile_pic || profile.profile_picture_url,
                                        },
                                    },
                                    { upsert: true }
                                );

                                conversation.displayName = profile.name || profile.username || conversation.displayName;
                                conversation.pictureUrl = profile.profile_pic || profile.profile_picture_url || conversation.pictureUrl;
                            }
                        } catch (error) {
                            this.logger.warn(`Could not fetch profile for ${conversation.senderId}: ${error.message}`);
                        }
                    }

                    return conversation;
                })
            );

            return result;
        } catch (error) {
            this.logger.error(`Error getting chat list: ${error.message}`);
            throw error;
        }
    }

    private getMessageTypeFromAttachment(attachmentType: string): string {
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

    private getAttachmentLabel(attachmentType: string): string {
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

    private getTemplateDescription(template: any): string {
        try {
            if (template.type === 'template' && template.payload.template_type === 'button') {
                return `ข้อความพร้อมปุ่ม: ${template.payload.text} (${template.payload.buttons.length} ปุ่ม)`;
            } else if (template.type === 'template' && template.payload.template_type === 'generic') {
                return `การ์ด ${template.payload.elements.length} รายการ`;
            } else if (template.type === 'template' && template.payload.template_type === 'media') {
                return `สื่อพร้อมปุ่ม: ${template.payload.elements[0].buttons.length} ปุ่ม`;
            } else {
                return `เทมเพลตประเภท: ${template.type}`;
            }
        } catch (error) {
            return 'เทมเพลต';
        }
    }

    private isValidObjectId(id: string): boolean {
        try {
            const ObjectId = require('mongoose').Types.ObjectId;
            return ObjectId.isValid(id);
        } catch (error) {
            return false;
        }
    }
}
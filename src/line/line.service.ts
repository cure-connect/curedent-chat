import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Client, WebhookEvent, MessageEvent } from '@line/bot-sdk';
import { ChatMessage, ChatMessageDocument } from '../chat/schemas/chat-message.schema';
import { ChatAccount, ChatAccountDocument } from '../chat/schemas/chat-account.schema';
import { ChatGateway } from '../chat/chat.gateway';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';

@Injectable()
export class LineService {
  private readonly logger = new Logger(LineService.name);

  constructor(
    @InjectModel(ChatMessage.name) private chatMessageModel: Model<ChatMessageDocument>,
    @InjectModel(ChatAccount.name) private chatAccountModel: Model<ChatAccountDocument>,
    private readonly chatGateway: ChatGateway,
    private readonly HttpService: HttpService
  ) { }
  
  async handleWebhook(body: any): Promise<void> {
    const channelId = body.destination;
    const chatAccount = await this.chatAccountModel
      .findOne({ platform: 'line', channelId })
      .exec();

    if (!chatAccount) {
      this.logger.warn(`ไม่พบ ChatAccount สำหรับ channelId: ${channelId}`);
      return;
    }

    const chatAccountId = chatAccount._id.toString();
    const client = new Client({ channelAccessToken: chatAccount.accessToken });
    const events: WebhookEvent[] = body.events;

    for (const event of events) {
      this.logger.log(`Line Webhook Event: ${JSON.stringify(event)}`);

      if (event.type === 'message') {
        switch (event.message.type) {
          case 'text':
            await this.handleTextMessage(event as MessageEvent, client, chatAccountId);
            break;
          case 'sticker':
            await this.handleStickerMessage(event as MessageEvent, client, chatAccountId);
            break;
          case 'image':
          case 'video':
          case 'audio':
          case 'file':
            await this.handleFileMessage(event as MessageEvent, client, chatAccountId);
            break;
          default:
            this.logger.log(`Not supported: ${event.message.type}`);
        }
      }
    }
  }

  async handleStickerMessage(event: MessageEvent, client: Client, chatAccountId: string): Promise<void> {
    if (event.message.type !== 'sticker') return;

    const userId = event.source.userId;
    if (!userId) return;

    // ข้อความ sticker จาก Line
    const stickerMessage = event.message as any;

    const message = await this.saveMessage({
      chatAccountId,
      senderId: userId,
      text: '[สติกเกอร์]', // ข้อความแสดงเมื่อไม่สามารถแสดง sticker ได้
      messageType: 'sticker',
      timestamp: new Date(event.timestamp),
      source: 'user',
      stickerId: stickerMessage.stickerId,
      packageId: stickerMessage.packageId
    });

    this.chatGateway.sendMessageToClient(chatAccountId, userId, message);
  }

  async handleFileMessage(event: MessageEvent, client: Client, chatAccountId: string): Promise<void> {
    const userId = event.source.userId;
    if (!userId) return;

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
        messageType: 'text', // บันทึกเป็นข้อความปกติ
        timestamp: new Date(event.timestamp),
        source: 'user'
      });

      this.chatGateway.sendMessageToClient(chatAccountId, userId, message);
    } catch (error) {
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

  async handleImageMessage(event: MessageEvent, client: Client, chatAccountId: string): Promise<void> {
    if (event.message.type !== 'image') return;
    
    const userId = event.source.userId;
    if (!userId) return;
    
    try {
      
      // preview
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
    } catch (error) {
      this.logger.error(`Error handling image message: ${error.message}`);
    }
  }

  async sendFile(userId: string, file: Express.Multer.File, chatAccountId: string): Promise<void> {
    const chatAccount = await this.chatAccountModel.findById(chatAccountId);
    if (!chatAccount) throw new Error('ไม่พบ ChatAccount ที่ระบุ');
    
    const client = new Client({ channelAccessToken: chatAccount.accessToken });
    
    try {
      // กำหนด URL สำหรับดาวน์โหลดไฟล์
      const fileUrl = `${process.env.API_BASE_URL}/uploads/${file.filename}`;
      
      // ตรวจสอบว่าเป็นรูปภาพหรือไม่
      const isImage = file.mimetype.startsWith('image/');
      
      // LINE API ต้องการ HTTPS URL เท่านั้น ถ้าใช้ localhost ต้องส่งเป็นข้อความแทน
      const webhookBaseUrl = process.env.WEBHOOK_BASE_URL;
      
      if (isImage && webhookBaseUrl && webhookBaseUrl.startsWith('https://')) {
        const httpsFileUrl = `${webhookBaseUrl}/uploads/${file.filename}`;
        
        await client.pushMessage(userId, [{
          type: 'image',
          originalContentUrl: httpsFileUrl,
          previewImageUrl: httpsFileUrl
        }]);
      } else {
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
    } catch (error) {
      this.logger.error(`Error sending file: ${error.message}`);
      throw error;
    }
  }
  async handleTextMessage(event: MessageEvent, client: Client, chatAccountId: string): Promise<void> {
    if (event.message.type !== 'text') return;

    const text = event.message.text;
    const userId = event.source.userId;
    if (!userId) return;

    const message = await this.saveMessage({
      chatAccountId,
      senderId: userId,
      text,
      messageType: 'text',
      timestamp: new Date(event.timestamp),
      source: 'user',
    });

    this.chatGateway.sendMessageToClient(chatAccountId, userId, message);

    // await client.replyMessage(event.replyToken, [{ type: 'text', text }]);
  }

  async pushMessage(userId: string, text: string, chatAccountId: string): Promise<void> {
    const chatAccount = await this.chatAccountModel.findById(chatAccountId);
    if (!chatAccount) throw new Error('ไม่พบ ChatAccount ที่ระบุ');

    const client = new Client({ channelAccessToken: chatAccount.accessToken });
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

  async saveMessage(data: Partial<ChatMessage>): Promise<ChatMessage> {
    const doc = new this.chatMessageModel(data);
    return doc.save();
  }

  async getUserMessageHistory(userId: string, limit = 50): Promise<ChatMessage[]> {
    return this.chatMessageModel.find({ senderId: userId })
      .sort({ timestamp: 1 })
      .limit(limit)
      .exec();
  }

  async getUserProfile(userId: string, chatAccountId: string): Promise<any> {
    const chatAccount = await this.chatAccountModel.findById(chatAccountId);
    if (!chatAccount) throw new Error('ไม่พบ ChatAccount ที่ระบุ');

    const client = new Client({ channelAccessToken: chatAccount.accessToken });
    return client.getProfile(userId);
  }

  async getChatList(chatAccountId: string): Promise<any[]> {
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

    // ดึง token ของ LINE จาก chatAccountId
    const chatAccount = await this.chatAccountModel.findById(chatAccountId);
    if (!chatAccount) throw new Error('ไม่พบ ChatAccount');

    const client = new Client({ channelAccessToken: chatAccount.accessToken });

    // ดึง profile ของแต่ละ sender
    const enrichedList = await Promise.all(
      list.map(async (chat) => {
        try {
          const profile = await client.getProfile(chat.senderId);
          return {
            ...chat,
            displayName: profile.displayName,
            pictureUrl: profile.pictureUrl,
          };
        } catch (error) {
          return {
            ...chat,
            displayName: 'Unknown',
            pictureUrl: null,
          };
        }
      }),
    );

    return enrichedList;
  }

    async getLineIntegrationStatus(token: string): Promise<Object> {
    try {
      const res = await firstValueFrom(
        this.HttpService.get('https://api.line.me/v2/bot/info', {
          headers: {
            Authorization: `${token}`
          }
        })
      )
      const data = res.data
      const response = {
        "status": "active",
        "isWorking": true,
        "config": {
          "lineChannelId": data.userId,
          "webhookUrl": `https://api.curedent.com/webhooks/line/${data.userId}`,
          "createdAt": new Date().toISOString(),
          "messageCount": 150
        }
      }
      return response

    } catch (error) {
      return {
        "data": {
          "status": "not_connected",
          "setupRequired": true
        }
      }
    }
  }

  async previewWebHook(body): Promise<object> {
    try {
      // await firstValueFrom(this.httpService.get('https://api.line.me/v2/bot/info', {
      //   headers: {
      //     Authorization: `Bearer ${body.lineChannelAccessToken}`,
      //   },
      // }),
      // );

      //do something on mongo wait p'ter adjust flow
      const sessionId = `preview_session_${Math.floor(Math.random() * 1000000)}`;
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const response = {
        webhookUrl: `https://api.curedent.com/webhooks/line/${body.lineChannelId}`,
        status: "preview",
        sessionId: sessionId,
        expiresAt: expiresAt,
        instructions: {
          steps: [
            '1. Copy the webhook URL below',
            '2. Open LINE Developers Console',
            '3. Navigate to Messaging API → Webhook settings',
            '4. Paste webhook URL and enable',
            '5. Return and click Save Configuration',
          ],
        }
      }
      return response
    } catch (error) {
      return {
        success: false,
        error: {
          code: "INVALID_LINE_CREDENTIALS",
          message: "Invalid LINE credentials provided",
          details: "The channel access token is invalid or expired"
        }
      }
    }
  }

  async saveIntegration(body): Promise<object> {
    try {
      const channelId = body.lineChannelId
      const chatAccount = await this.chatAccountModel
        .findOne({ platform: 'line', channelId })
        .exec();

      if (!chatAccount) {
        const insert = {
          userId: body.lineChannelId,
          channelId: body.lineChannelId,
          secret: body.lineChannelSecret,
          platform: "line",
          accessToken: body.lineChannelAccessToken,
          webhookUrl: "test",
          status: "test",
          createdAt: new Date().toISOString()
        }

        const create = new this.chatAccountModel({ ...insert })
        console.log('created', create)
        await create.save()
      }
      const response = {
        integrationId: "xxxx",
        status: "active",
        webhookUrl: `https://api.curedent.com/webhooks/line/${body.lineChannelId}`,
      }
      return response
    } catch (error) {
      console.log('error', error)
      return {
        success: false,
        error: {
          code: "INVALID_LINE_CREDENTIALS",
          message: "Invalid LINE credentials provided",
          details: "The channel access token is invalid or expired"
        }
      }
    }
  }

  //
  async updatedIntegration(body): Promise<object> {
    try {

      const updated = this.chatAccountModel.updateOne({ clinicId: body.clinicId })
      const response = {
        "integrationId": "integration_456",
        "status": "active",
        "updatedAt": "2024-01-15T11:00:00.000Z"
      }

      return response
    } catch (error) {
      return {
        success: false,
        error: {

        }
      }
    }
  }

  async deleteInteration(param): Promise<object> {
    try {

      const updated = this.chatAccountModel.deleteOne({ clinicId: param })
      const response = {
        success: true,
        //do something soft delete
      }

      return response
    } catch (error) {
      return {
        success: false,
        error: {

        }
      }
    }
  }
}
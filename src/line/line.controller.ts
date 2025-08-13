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
  UseGuards,
  Put,
  Delete,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { LineService } from './line.service';
import * as line from '@line/bot-sdk';
import { ChatAccountService } from '../chat/chat-account.service';
import { LineIntegrationDto } from './dto/previewwebhook.dto';
import { JwtAuthGuard } from 'src/middleware/auth';
import { SaveIntegrationDto } from './dto/saveintegration.dto';
import { UpdateIntegrationDto } from './dto/updatedintegration.dto';

@Controller('line')
export class LineController {
  constructor(
    private readonly lineService: LineService,
    private readonly chatAccountService: ChatAccountService,
  ) { }

  // Webhook endpoint สำหรับรับข้อความจาก LINE OA ตาม chatAccountId
  @Post('webhook/:chatAccountId')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Param('chatAccountId') chatAccountId: string,
    @Body() body: any,
    @Headers('x-line-signature') signature: string,
  ): Promise<string> {

    const chatAccount = await this.chatAccountService.findByChannelId(chatAccountId);

    if (!chatAccount) throw new Error('Invalid chatAccountId');

    try {
      const isValid = line.validateSignature(
        // stringBody,
        JSON.stringify(body),
        chatAccount.secret,
        signature
      );
    } catch (error) {
      console.error('Error validating signature:', error);
    }

    await this.lineService.handleWebhook(body);
    return 'OK';
  }

  // ส่งข้อความถึง user ผ่าน LINE ของคลินิก
  @Post('send/:chatAccountId/:userId')
  async sendMessage(
    @Param('chatAccountId') chatAccountId: string,
    @Param('userId') userId: string,
    @Body('message') message: string,
  ): Promise<{ success: boolean }> {
    await this.lineService.pushMessage(userId, message, chatAccountId);
    return { success: true };
  }

  // ดึงประวัติแชทของ userId
  @Get('history/:chatAccountId/:userId')
  async getMessageHistory(
    @Param('chatAccountId') chatAccountId: string,
    @Param('userId') userId: string,
    @Query('limit') limit: number,
  ): Promise<any> {
    return this.lineService.getUserMessageHistory(userId, limit || 50);
  }

  // ดึงข้อมูลโปรไฟล์ของ LINE user ในแต่ละคลินิก
  @Get('user/:chatAccountId/:userId')
  async getUserProfile(
    @Param('chatAccountId') chatAccountId: string,
    @Param('userId') userId: string,
  ): Promise<any> {
    return this.lineService.getUserProfile(userId, chatAccountId);
  }

  // line.controller.ts
  @Get('chat-list/:chatAccountId')
  async getChatList(@Param('chatAccountId') chatAccountId: string): Promise<any> {
    return this.lineService.getChatList(chatAccountId)
  }

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
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  )
  async uploadFile(
    @Param('chatAccountId') chatAccountId: string,
    @Param('userId') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ success: boolean }> {
    if (!file) {
      throw new Error('ไม่พบไฟล์ที่อัปโหลด');
    }

    await this.lineService.sendFile(userId, file, chatAccountId);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('integrations/line')
  async getLineIntegrationStatus(
    @Headers('Authorization') token: string) {
    const result = await this.lineService.getLineIntegrationStatus(token);
    return {
      success: true,
      data: result,
    };
  }

  @Post('integrations/line/preview')
  async previewWebHookService(
    @Body() body: LineIntegrationDto
  ): Promise<object> {
    const result = await this.lineService.previewWebHook(body);
    return {
      success: true,
      data: result,
    };
  }

  @Post('integrations/line')
  async saveIntegrationsService(
    @Body() body: SaveIntegrationDto
  ): Promise<object> {
    const result = await this.lineService.saveIntegration(body);
    return {
      success: true,
      data: result,
      message: "LINE OA integration saved successfully"
    }
  }

  @Put('integrations/line')
  async updateIntegrationsService(
    @Body() body: UpdateIntegrationDto
  ): Promise<object> {
    const result = await this.lineService.updatedIntegration(body)
    return {
      success: true,
      data: result,
      message: "Integration updated successfully"
    }
  }

  @Delete('integrations/line')
  async deleteIntegrationsService(
    @Param() param: any
  ): Promise<object> {
    const result = await this.lineService.deleteInteration(param)
    return {
      success: true,
      data: result,
      message: "Integration removed successfully"
    }
  }

}

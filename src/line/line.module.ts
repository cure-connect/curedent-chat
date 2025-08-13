import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { LineController } from './line.controller';
import { LineService } from './line.service';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatMessage, ChatMessageSchema } from '../chat/schemas/chat-message.schema';
import { ChatAccount, ChatAccountSchema } from '../chat/schemas/chat-account.schema';
import { ChatContact, ChatContactSchema } from '../chat/schemas/chat-contact.schema';
import { ChatModule } from '../chat/chat.module';
import { ChatAccountService } from '../chat/chat-account.service';

@Module({
  imports: [
    HttpModule,
    ConfigModule,
    ChatModule,
    MongooseModule.forFeature([
      { name: ChatMessage.name, schema: ChatMessageSchema },
      { name: ChatAccount.name, schema: ChatAccountSchema },
      { name: ChatContact.name, schema: ChatContactSchema },
    ])
  ],
  controllers: [LineController],
  providers: [LineService, ChatAccountService],
  exports: [LineService]
})
export class LineModule {}
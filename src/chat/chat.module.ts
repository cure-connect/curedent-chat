import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatMessage, ChatMessageSchema } from './schemas/chat-message.schema';
import { ChatAccount, ChatAccountSchema } from './schemas/chat-account.schema';
import { ChatContact, ChatContactSchema } from './schemas/chat-contact.schema';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ChatMessage.name, schema: ChatMessageSchema },
      { name: ChatAccount.name, schema: ChatAccountSchema },
      { name: ChatContact.name, schema: ChatContactSchema },
    ]),
  ],
  providers: [ChatService, ChatGateway],
  exports: [ChatService, ChatGateway],
})
export class ChatModule {}
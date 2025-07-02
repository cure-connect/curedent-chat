import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  SubscribeMessage,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: 'http://localhost:3000',
    credentials: true
  }
})
@Injectable()
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('ChatGateway');

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // emit message ไปยัง frontend ตาม chatAccountId + senderId
  sendMessageToClient(chatAccountId: string, senderId: string, message: any) {
    this.server.to(`${chatAccountId}:${senderId}`).emit('newMessage', message);
  }

  // ให้ client join room ตาม accountId + senderId เพื่อแยกแชท
  // @SubscribeMessage('joinRoom')
  // handleJoinRoom(@MessageBody() payload: { chatAccountId: string; senderId: string }, client: Socket) {
  //   const room = `${payload.chatAccountId}:${payload.senderId}`;
  //   client.join(room);
  //   this.logger.log(`Client ${client.id} joined room ${room}`);
  // }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @MessageBody() payload: { chatAccountId: string; senderId: string },
    @ConnectedSocket() client: Socket 
  ) {
    if (!client || typeof client.join !== 'function') {
      this.logger.error('Client is invalid or missing join method');
      return { success: false, error: 'Invalid client connection' };
    }

    const room = `${payload.chatAccountId}:${payload.senderId}`;
    
    try {
      client.join(room);
      this.logger.log(`Client ${client.id} joined room ${room}`);
      return { success: true, room };
    } catch (error) {
      this.logger.error(`Error joining room: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}
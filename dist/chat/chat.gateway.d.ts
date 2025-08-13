import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
export declare class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    server: Server;
    private logger;
    handleConnection(client: Socket): void;
    handleDisconnect(client: Socket): void;
    sendMessageToClient(chatAccountId: string, senderId: string, message: any): void;
    handleJoinRoom(payload: {
        chatAccountId: string;
        senderId: string;
    }, client: Socket): {
        success: boolean;
        room: string;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        room?: undefined;
    };
}

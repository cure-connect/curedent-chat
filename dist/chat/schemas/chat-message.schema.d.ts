import { Document } from 'mongoose';
export type ChatMessageDocument = ChatMessage & Document;
export declare class ChatMessage {
    chatAccountId: string;
    senderId: string;
    messageId?: string;
    text: string;
    source: string;
    messageType: string;
    timestamp: Date;
    stickerId?: string;
    packageId?: string;
    fileName?: string;
    fileUrl?: string;
    fileSize?: number;
    fileType?: string;
}
export declare const ChatMessageSchema: import("mongoose").Schema<ChatMessage, import("mongoose").Model<ChatMessage, any, any, any, Document<unknown, any, ChatMessage> & ChatMessage & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, ChatMessage, Document<unknown, {}, import("mongoose").FlatRecord<ChatMessage>> & import("mongoose").FlatRecord<ChatMessage> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>;

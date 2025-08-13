import { Document } from 'mongoose';
export type ChatContactDocument = ChatContact & Document;
export declare class ChatContact {
    chatAccountId: string;
    senderId: string;
    displayName?: string;
    pictureUrl?: string;
    lastMessageAt?: Date;
}
export declare const ChatContactSchema: import("mongoose").Schema<ChatContact, import("mongoose").Model<ChatContact, any, any, any, Document<unknown, any, ChatContact> & ChatContact & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, ChatContact, Document<unknown, {}, import("mongoose").FlatRecord<ChatContact>> & import("mongoose").FlatRecord<ChatContact> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>;

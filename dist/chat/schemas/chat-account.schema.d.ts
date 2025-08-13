import { Document, Types } from 'mongoose';
export type ChatAccountDocument = ChatAccount & Document;
export declare class ChatAccount {
    _id: Types.ObjectId;
    userId: string;
    platform: string;
    channelId: string;
    accessToken: string;
    secret: string;
    displayName?: string;
}
export declare const ChatAccountSchema: import("mongoose").Schema<ChatAccount, import("mongoose").Model<ChatAccount, any, any, any, Document<unknown, any, ChatAccount> & ChatAccount & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, ChatAccount, Document<unknown, {}, import("mongoose").FlatRecord<ChatAccount>> & import("mongoose").FlatRecord<ChatAccount> & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}>;

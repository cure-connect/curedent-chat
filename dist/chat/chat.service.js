"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const chat_message_schema_1 = require("./schemas/chat-message.schema");
const chat_account_schema_1 = require("./schemas/chat-account.schema");
const chat_contact_schema_1 = require("./schemas/chat-contact.schema");
let ChatService = class ChatService {
    chatMessageModel;
    chatAccountModel;
    chatContactModel;
    constructor(chatMessageModel, chatAccountModel, chatContactModel) {
        this.chatMessageModel = chatMessageModel;
        this.chatAccountModel = chatAccountModel;
        this.chatContactModel = chatContactModel;
    }
    async saveMessage(data) {
        const newMessage = new this.chatMessageModel(data);
        return newMessage.save();
    }
    async findMessages(chatAccountId, senderId) {
        return this.chatMessageModel.find({ chatAccountId, senderId }).sort({ timestamp: 1 }).exec();
    }
};
exports.ChatService = ChatService;
exports.ChatService = ChatService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(chat_message_schema_1.ChatMessage.name)),
    __param(1, (0, mongoose_1.InjectModel)(chat_account_schema_1.ChatAccount.name)),
    __param(2, (0, mongoose_1.InjectModel)(chat_contact_schema_1.ChatContact.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model])
], ChatService);
//# sourceMappingURL=chat.service.js.map
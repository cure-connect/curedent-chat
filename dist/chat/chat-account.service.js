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
exports.ChatAccountService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const chat_account_schema_1 = require("./schemas/chat-account.schema");
let ChatAccountService = class ChatAccountService {
    chatAccountModel;
    constructor(chatAccountModel) {
        this.chatAccountModel = chatAccountModel;
    }
    async findById(id) {
        const chatAccount = await this.chatAccountModel.findById(id).exec();
        if (!chatAccount) {
            throw new common_1.NotFoundException('ChatAccount not found');
        }
        return chatAccount;
    }
    async findByChannelId(channelId) {
        return this.chatAccountModel.findOne({ platform: 'line', channelId }).exec();
    }
    async findOne(filter) {
        return this.chatAccountModel.findOne(filter).exec();
    }
    async create(data) {
        const newAccount = new this.chatAccountModel(data);
        return newAccount.save();
    }
    async findAll() {
        return this.chatAccountModel.find().exec();
    }
    async update(id, data) {
        const updated = await this.chatAccountModel
            .findByIdAndUpdate(id, data, { new: true })
            .exec();
        if (!updated)
            throw new common_1.NotFoundException('ChatAccount not found');
        return updated;
    }
    async delete(id) {
        await this.chatAccountModel.findByIdAndDelete(id).exec();
    }
};
exports.ChatAccountService = ChatAccountService;
exports.ChatAccountService = ChatAccountService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(chat_account_schema_1.ChatAccount.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], ChatAccountService);
//# sourceMappingURL=chat-account.service.js.map
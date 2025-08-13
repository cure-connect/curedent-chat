"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetaModule = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const config_1 = require("@nestjs/config");
const meta_controller_1 = require("./meta.controller");
const meta_service_1 = require("./meta.service");
const mongoose_1 = require("@nestjs/mongoose");
const chat_message_schema_1 = require("../chat/schemas/chat-message.schema");
const chat_account_schema_1 = require("../chat/schemas/chat-account.schema");
const chat_contact_schema_1 = require("../chat/schemas/chat-contact.schema");
const chat_module_1 = require("../chat/chat.module");
const chat_account_service_1 = require("../chat/chat-account.service");
let MetaModule = class MetaModule {
};
exports.MetaModule = MetaModule;
exports.MetaModule = MetaModule = __decorate([
    (0, common_1.Module)({
        imports: [
            axios_1.HttpModule,
            config_1.ConfigModule,
            chat_module_1.ChatModule,
            mongoose_1.MongooseModule.forFeature([
                { name: chat_message_schema_1.ChatMessage.name, schema: chat_message_schema_1.ChatMessageSchema },
                { name: chat_account_schema_1.ChatAccount.name, schema: chat_account_schema_1.ChatAccountSchema },
                { name: chat_contact_schema_1.ChatContact.name, schema: chat_contact_schema_1.ChatContactSchema },
            ])
        ],
        controllers: [meta_controller_1.MetaController],
        providers: [meta_service_1.MetaService, chat_account_service_1.ChatAccountService],
        exports: [meta_service_1.MetaService]
    })
], MetaModule);
//# sourceMappingURL=meta.module.js.map
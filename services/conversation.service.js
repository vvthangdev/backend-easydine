const { DataTypes, Op, or } = require('sequelize');
const sequelize = require('../config/db.config');
const conversation = require('../models/conversation.js');

const Conversation = require('../models/conversation.js')(sequelize, DataTypes);
const Message = require('../models/message.js')(sequelize, DataTypes);
// conversationData = {user1, user2, last_message_id = 0} . create tin nhan sau do update
async function createConversation(conversationData) {
    const conversation = new Conversation({
        "user1": conversationData.user1_id,
        "user2": conversationData.user2_id,
        "last_message": conversationData.message
    });
    const newConversation = await conversation.save();
    return newConversation
}

async function getListConversations(userId) {
    const conversations = await Conversation.findAll({
        where: {
            [Op.or]: [
                {user1: userId},
                {user2: userId}
            ]
        },
        order: [["updated_at", "DESC"]]
    });
    return conversations;
};

async function deleteConversation(conversationId) {
    const conversation = await Conversation.findByPk(conversationId);
    if (!conversation) {
        const error = new Error("Conversation not found");
        error.code = 404;
        throw error;
    } 
    conversation.destroy();
    return;
}

async function getListMessages(conversationId) {
    const messages = await Message.findAll({
        where: {conversationId},
        order: [["time", ASC]],
    });
    return messages;
}

async function deleteMessage(messageId) { 
    const message = await Message.findByPk(messageId);
    if (!message) {
        const error = new Error("Message not found");
        error.code = 404;
        throw error;
    }
    message.destroy();
    return;
}
async function sendMessage(io, socket, users, messageData) {
    
}
module.exports = {
    createConversation,
    deleteConversation,
    getListConversations,
    getListMessages,
    deleteMessage,
    sendMessage,
};
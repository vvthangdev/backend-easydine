const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const Message = require('../models/message.js')(sequelize, DataTypes);

// messageData = {sender_id, message, conversation_id}
async function createMessage(messageData) {
    try {
        let newMessage = new Message({...messageData});
        newMessage.save();
    } catch(e) { 
        console.log(e);
    }
}
module.exports = {
    createMessage,
}
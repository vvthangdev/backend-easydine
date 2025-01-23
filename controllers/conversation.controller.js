const message = require('../models/message');
const User = require('../models/user.model');
const conversationService = require('../services/conversation.service');

const createConversation = async (req, res) => {
    try {
        const { user1_id, user2_id, message } = req.body; // object

        // Validation checks
        if (!user1_id || !user2_id || !message) {
            return res.status(400).json({
                status: "error",
                message: "Bad request: Missing required fields"
            });
        }

        // Create conversation
        const conversation = await conversationService.createConversation({ user1_id, user2_id });

        // Assuming the message is the first message of the conversation
        const initialMessage = await conversationService.addMessageToConversation(conversation._id, message, user1_id);

        return res.json({
            status: "success",
            message: "Conversation created successfully with the first message",
            data: { conversation, initialMessage }
        });

    } catch (e) {
        console.log(e);
        res.status(500).json({
            status: "error",
            message: e.message || "An error occurred while creating conversation"
        });
    }
};

const getListConversations = async (req, res) => {
    try {
        const user = req.user; // Assuming user info is added by auth middleware

        const conversations = await conversationService.getListConversations(user.id);

        if (!conversations || conversations.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "No conversations found"
            });
        }

        return res.json({
            status: "success",
            message: "Conversations fetched successfully",
            data: conversations
        });
    } catch (e) {
        console.log(e);
        return res.status(500).json({
            status: "error",
            message: e.message || "An error occurred while fetching conversations"
        });
    }
};

const deleteConversation = async (req, res) => {
    try {
        const conversationId = req.params.conversationId; // Get conversationId from params

        // Delete conversation
        const result = await conversationService.deleteConversation(conversationId);

        if (!result) {
            return res.status(404).json({
                status: "error",
                message: "Conversation not found"
            });
        }

        return res.status(200).json({
            status: "success",
            message: "Conversation deleted successfully"
        });
    } catch (e) {
        console.log(e);
        return res.status(500).json({
            status: "error",
            message: e.message || "An error occurred while deleting conversation"
        });
    }
};

const getListMessages = async (req, res) => {
    try {
        const conversationId = req.params.conversationId; // Get conversationId from params
        const messages = await conversationService.getListMessages(conversationId);

        if (!messages || messages.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "No messages found"
            });
        }

        return res.json({
            status: "success",
            message: "Messages fetched successfully",
            data: messages
        });
    } catch (e) {
        console.log(e);
        return res.status(500).json({
            status: "error",
            message: e.message || "An error occurred while getting list of messages"
        });
    }
};

const deleteMessage = async (req, res) => {
    try {
        const messageId = req.params.messageId; // Get messageId from params

        // Delete message
        const result = await conversationService.deleteMessage(messageId);

        if (!result) {
            return res.status(404).json({
                status: "error",
                message: "Message not found"
            });
        }

        return res.status(200).json({
            status: "success",
            message: "Message deleted successfully"
        });
    } catch (e) {
        console.log(e);
        return res.status(500).json({
            status: "error",
            message: e.message || "An error occurred while deleting message"
        });
    }
};

module.exports = {
    createConversation,
    getListConversations,
    deleteConversation,
    getListMessages,
    deleteMessage
};

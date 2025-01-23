
const express = require("express");
const router = express.Router();
const conversationController = require("../controllers/conversation.controller");
const authMiddleWare = require("../middlewares/auth.middleware");

// Helper function to validate email format using regex
const isValidEmail = (email) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
};

// Route to handle contact form submission
router.post("/contact", authMiddleWare.authenticateToken, async (req, res) => {
    const { name, email, phone, message } = req.body;

    // Manual validation checks
    if (!name || !email || !phone || !message) {
        return res.status(400).json({
            success: false,
            message: "Vui lòng cung cấp đầy đủ thông tin: tên, email, số điện thoại, và tin nhắn.",
        });
    }

    if (!isValidEmail(email)) {
        return res.status(400).json({
            success: false,
            message: "Email không hợp lệ. Vui lòng nhập email hợp lệ.",
        });
    }

    try {
        // Process contact information (save to DB, send email, etc.)
        await conversationController.handleContact({ name, email, phone, message });

        return res.status(200).json({
            success: true,
            message: "Thông tin đã được gửi thành công!",
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Đã xảy ra lỗi khi gửi thông tin!",
        });
    }
});

// Routes for conversation management
router.post("/", authMiddleWare.authenticateToken, conversationController.createConversation); // Create conversation

router.get("/", authMiddleWare.authenticateToken, conversationController.getListConversations); // Get list of conversations

router.delete("/:conversationId", authMiddleWare.authenticateToken, conversationController.deleteConversation); // Delete conversation

router.delete("/message/:conversationId/:messageId", authMiddleWare.authenticateToken, conversationController.deleteMessage); // Delete message

router.get("/:conversationId", authMiddleWare.authenticateToken, conversationController.getListMessages); // Get all messages of conversation

module.exports = router;

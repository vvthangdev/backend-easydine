const express = require("express");
const voucherController = require("../controllers/voucher.controller");
const authMiddleware = require("../middlewares/auth.middleware");

const router = express.Router();

// Tạo voucher mới
router.get("/all", authMiddleware.authenticateToken, voucherController.getAllVouchers);

// Tạo voucher mới
router.post("/", authMiddleware.authenticateToken, voucherController.createVoucher);

// Lấy voucher theo code
router.get("/", authMiddleware.authenticateToken, voucherController.getVoucher);

// Lấy voucher theo ID
router.get("/:id", authMiddleware.authenticateToken, voucherController.getVoucherById);

// Cập nhật voucher
router.patch("/:id", authMiddleware.authenticateToken, voucherController.updateVoucher);

// Xóa voucher
router.delete("/:id", authMiddleware.authenticateToken, voucherController.deleteVoucher);

// Thêm người dùng vào voucher
router.post("/:id/users", authMiddleware.authenticateToken, voucherController.addUsersToVoucher);

// Xóa người dùng khỏi voucher
router.delete("/:id/users", authMiddleware.authenticateToken, voucherController.removeUsersFromVoucher);

module.exports = router;
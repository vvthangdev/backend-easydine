const express = require("express");
const voucherController = require("../controllers/voucher.controller");
const authMiddleware = require("../middlewares/auth.middleware");

const router = express.Router();

// Lấy tất cả voucher (mọi vai trò)
router.get(
  "/",
  authMiddleware.authenticateToken,
  voucherController.getAllVouchers
);

// Tạo voucher mới (chỉ ADMIN)
router.post(
  "/",
  authMiddleware.authenticateToken,
  authMiddleware.requireStaff,
  voucherController.createVoucher
);

// Lấy voucher theo code (mọi vai trò)
router.get(
  "/code/:code",
  authMiddleware.authenticateToken,
  voucherController.getVoucher
);

// Thêm người dùng vào voucher (chỉ ADMIN)
router.post(
  "/add/users",
  authMiddleware.authenticateToken,
  authMiddleware.requireStaff,
  voucherController.addUsersToVoucher
);

// Xóa người dùng khỏi voucher (chỉ ADMIN)
router.delete(
  "/delete/users",
  authMiddleware.authenticateToken,
  authMiddleware.requireStaff,
  voucherController.removeUsersFromVoucher
);

// Áp dụng voucher cho đơn hàng (chỉ STAFF hoặc CUSTOMER)
router.post(
  "/apply",
  authMiddleware.authenticateToken,
  voucherController.applyVoucherToOrder
);

// Lấy voucher theo ID (mọi vai trò)
router.get(
  "/:id",
  authMiddleware.authenticateToken,
  voucherController.getVoucherById
);

// Cập nhật voucher (chỉ ADMIN)
router.patch(
  "/:id",
  authMiddleware.authenticateToken,
  authMiddleware.requireStaff,
  voucherController.updateVoucher
);

// Xóa voucher (chỉ ADMIN)
router.delete(
  "/:id",
  authMiddleware.authenticateToken,
  authMiddleware.requireStaff,
  voucherController.deleteVoucher
);

module.exports = router;

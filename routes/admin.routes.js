const express = require("express");
const adminController = require("../controllers/admin.controller.js");
const authMiddleware = require("../middlewares/auth.middleware.js");

const router = express.Router();

// Xóa người dùng (nhận id hoặc username trong body)
router.delete(
  "/delete",
  authMiddleware.authenticateToken,
  authMiddleware.adminRoleAuth,
  adminController.deleteUserByAdmin
);

// Cập nhật người dùng (nhận id hoặc username trong body)
router.patch(
  "/update",
  authMiddleware.authenticateToken,
  authMiddleware.adminRoleAuth,
  adminController.updateUserByAdmin
);

// Khóa người dùng
router.patch(
  "/deactivate",
  authMiddleware.authenticateToken,
  authMiddleware.adminRoleAuth,
  adminController.deactivateUser
);

// Mở khóa người dùng
router.patch(
  "/activate",
  authMiddleware.authenticateToken,
  authMiddleware.adminRoleAuth,
  adminController.activateUser
);

// Lấy thông tin khách hàng
router.get(
  "/customer",
  authMiddleware.authenticateToken,
  authMiddleware.adminRoleAuth,
  adminController.adminGetUserInfo
);

router.get(
  "/staff",
  authMiddleware.authenticateToken,
  authMiddleware.adminRoleAuth,
  adminController.getAllStaff
);

module.exports = router;
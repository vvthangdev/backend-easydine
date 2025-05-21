const express = require("express");
const userMiddleware = require("../middlewares/user.middleware.js");
const adminController = require("../controllers/admin.controller.js");
const authMiddleware = require("../middlewares/auth.middleware.js");

const router = express.Router();

// Xóa người dùng
router.delete(
  "/delete",
  authMiddleware.authenticateToken,
  authMiddleware.adminRoleAuth,
  adminController.deleteUserByAdmin
);

// Cập nhật người dùng
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

// Các route khác giữ nguyên
router.delete(
  "/delete-user",
  authMiddleware.authenticateToken,
  authMiddleware.adminRoleAuth,
  adminController.adminDeleteUser
);
router.patch(
  "/update-user/:id",
  authMiddleware.authenticateToken,
  authMiddleware.adminRoleAuth,
  adminController.adminUpdateUser
);
router.get(
  "/customer",
  authMiddleware.authenticateToken,
  authMiddleware.adminRoleAuth,
  adminController.adminGetUserInfo
);

module.exports = router;
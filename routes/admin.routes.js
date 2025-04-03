const express = require("express");
const userMiddleware = require("../middlewares/user.middleware.js");
const adminController = require("../controllers/admin.controller.js");
const authMiddleware = require("../middlewares/auth.middleware.js");

const router = express.Router();

// Middleware để xác thực token và vai trò admin
// router.use(authMiddleware.authenticateToken);
// router.use(authMiddleware.adminRoleAuth);

router.delete("/delete-user", adminController.adminDeleteUser);
router.patch("/update-user/:id", adminController.adminUpdateUser);
router.get("/customer", adminController.adminGetUserInfo);

module.exports = router;
const express = require("express");
const userMiddleware = require("../middlewares/user.middleware.js");
const adminController = require("../controllers/admin.controller.js");
const userUtil = require("../utils/user.util.js");
const authMiddware = require("../middlewares/auth.middleware.js");

const router = express.Router();

// router.use(authMiddware.authenticateToken);
// router.use(authMiddware.adminRoleAuth);

router.delete("/delete-user", adminController.adminDeleteUser);

router.patch("/update-user/:id", adminController.adminUpdateUser);

router.get("/customer", adminController.adminGetUserInfo);

module.exports = router;

const express = require("express");
const userMiddleware = require("../middlewares/user.middleware.js");
const userController = require("../controllers/user.controller.js");
const userUtil = require("../utils/user.util.js");
const authMiddware = require("../middlewares/auth.middleware.js");

const router = express.Router();

router.get("/all-users", userController.getAllUsers);

router.get(
  "/user-info",
  authMiddware.authenticateToken,
  userController.userInfo
);

router.post(
  "/signup",
  userUtil.validateSignUpSignUp,
  userMiddleware.checkUserExistsSignUp,
  userController.signUp
);

router.post("/login", userMiddleware.checkUserExistLogin, userController.login);

router.post("/refresh-token", userController.refreshToken);

router.post("/logout", authMiddware.authenticateToken, userController.logout);
// Route to update user information (requires authentication)
router.patch(
  "/update-user",
  authMiddware.authenticateToken,
  userController.updateUser
);

// Route to delete user (requires authentication)
router.delete(
  "/delete",
  authMiddware.authenticateToken,
  userController.deleteUser
);

router.post(
  "/sendOTP",
  userController.sendOTP
)

module.exports = router;

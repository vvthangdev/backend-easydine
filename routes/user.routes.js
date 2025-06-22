const express = require("express");
const userMiddleware = require("../middlewares/user.middleware.js");
const userController = require("../controllers/user.controller.js");
const userUtil = require("../utils/user.util.js");
const authMiddleware = require("../middlewares/auth.middleware.js");

const passport = require("passport");
const rateLimit = require("express-rate-limit");

const router = express.Router();

router.get("/all-users", userController.getAllUsers);
router.get(
  "/user-info",
  authMiddleware.authenticateToken,
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
router.post("/logout", authMiddleware.authenticateToken, userController.logout);
router.patch(
  "/update-user",
  authMiddleware.authenticateToken,
  userController.updateUser
);
router.delete(
  "/delete",
  authMiddleware.authenticateToken,
  userController.deleteUser
);
router.post("/sendOTP", userController.sendOTP);
router.get(
  "/all",
  authMiddleware.authenticateToken,
  userController.getAllUsers
);
router.get(
  "/search",
  authMiddleware.authenticateToken,
  userController.searchUsers
);

router.post(
  "/user",
  authMiddleware.authenticateToken,
  userController.getUserById
);

// Rate limit cho Google login
const googleLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 10,
  message: "Quá nhiều yêu cầu đăng nhập Google, vui lòng thử lại sau!",
});

// Route cho Google OAuth
router.get(
  "/auth/google",
  googleLoginLimiter,
  passport.authenticate("google", { scope: ["profile", "email"] })
);
router.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "https://vuvanthang.website/login?error=auth_failed",
  }),
  userController.googleLoginCallback
);

router.post(
  "/change-password",
  authMiddleware.authenticateToken,
  userController.changePassword
);

router.post("/auth/google/firebase", userController.googleFirebaseLogin);

module.exports = router;

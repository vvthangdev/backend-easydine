require("dotenv").config();
const express = require("express");
const app = express();
const authUtil = require("../utils/auth.util");
const User = require("../models/user.model");
const { Auth, LoginCredentials } = require("two-step-auth");

app.use(express.json());

async function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).send("Access token required!");
  }

  try {
    // Sử dụng ACCESS_TOKEN_SECRET để xác thực access token
    const user = await authUtil.verifyToken(
      token,
      process.env.ACCESS_TOKEN_SECRET
    );

    if (!user) {
      return res.status(403).send("Invalid or expired access token!");
    }
    // Gán thông tin người dùng vào request
    // Đặt payload vào req.user mà không cần nested "payload"
    const userObject = await User.findOne({
      where: {
        username: user.payload.username,
      },
    });    
    // req.user = user.payload ? user.payload : user;
    // console.log(req.user)
    // console.log("AAAAAAAAAAAA");
    req.user = userObject;
    next(); // Chuyển sang middleware hoặc route tiếp theo
  } catch (error) {
    console.log(error);
    return res.status(403).send("Invalid or expired access token!");
  }
}

async function adminRoleAuth(req, res, next) {
  try {
    // Kiểm tra nếu vai trò trong yêu cầu là ADMIN
    // console.log(req.user);
    if (req.user.role === "ADMIN") {
      // console.log("Next")
      // Chuyển tiếp yêu cầu đến middleware hoặc route handler tiếp theo
      return next();
    } else {
      // Nếu không phải ADMIN, trả về lỗi quyền truy cập
      return res.status(403).json({
        message: "Forbidden: You do not have the required permissions.",
      });
    }
  } catch (error) {
    // Xử lý lỗi nếu có
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
}

async function notAdminRoleAuth(req, res, next) {
  try {
    // Kiểm tra nếu vai trò trong yêu cầu là ADMIN
    // console.log(req.user);
    if (req.user.role != "ADMIN") {
      // Chuyển tiếp yêu cầu đến middleware hoặc route handler tiếp theo
      return next();
    } else {
      // Nếu là ADMIN, trả về lỗi quyền truy cập
      return res.status(403).json({
        message: "Forbidden: You do not have the required permissions.",
      });
    }
  } catch (error) {
    // Xử lý lỗi nếu có
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
}


module.exports = {
  authenticateToken,
  adminRoleAuth,
  notAdminRoleAuth,
};

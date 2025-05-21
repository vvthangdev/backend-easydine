require("dotenv").config();
const express = require("express");
const app = express();
const authUtil = require("../utils/auth.util");
const User = require("../models/user.model");

app.use(express.json());

async function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      status: "ERROR",
      message: "Access token required!",
    });
  }

  try {
    const decoded = await authUtil.verifyToken(token, process.env.ACCESS_TOKEN_SECRET);
    if (!decoded) {
      return res.status(403).json({
        status: "ERROR",
        message: "Invalid or expired access token!",
      });
    }

    // Tìm người dùng trực tiếp bằng _id từ payload
    const userObject = await User.findById(decoded.payload._id);
    if (!userObject) {
      return res.status(403).json({
        status: "ERROR",
        message: "Invalid user ID in token!",
      });
    }

    // Kiểm tra trạng thái isActive
    if (!userObject.isActive) {
      return res.status(403).json({
        status: "ERROR",
        message: "Tài khoản của bạn đã bị vô hiệu hóa!",
      });
    }

    req.user = userObject;
    // console.log(`vvt01: ${req.user}`)
    next();
  } catch (error) {
    console.error("Error in authenticateToken:", error);
    return res.status(403).json({
      status: "ERROR",
      message: "Invalid or expired access token!",
    });
  }
}

async function adminRoleAuth(req, res, next) {
  try {
    if (req.user.role === "ADMIN") {
      return next();
    } else {
      return res.status(403).json({
        status: "ERROR",
        message: "Forbidden: You do not have the required permissions.",
      });
    }
  } catch (error) {
    return res.status(500).json({
      status: "ERROR",
      message: "Internal Server Error",
      error: error.message,
    });
  }
}

async function notAdminRoleAuth(req, res, next) {
  try {
    if (req.user.role !== "ADMIN") {
      return next();
    } else {
      return res.status(403).json({
        status: "ERROR",
        message: "Forbidden: You do not have the required permissions.",
      });
    }
  } catch (error) {
    return res.status(500).json({
      status: "ERROR",
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
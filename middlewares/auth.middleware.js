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
    return res.status(401).send("Access token required!");
  }

  try {
    const decoded = await authUtil.verifyToken(token, process.env.ACCESS_TOKEN_SECRET);
    if (!decoded) {
      return res.status(403).send("Invalid or expired access token!");
    }

    const userObject = await User.findOne({ username: decoded.payload.username });
    if (!userObject || userObject._id.toString() !== decoded.payload._id) {
      return res.status(403).send("Invalid user ID in token!");
    }

    req.user = userObject;
    next();
  } catch (error) {
    console.log(error);
    return res.status(403).send("Invalid or expired access token!");
  }
}

async function adminRoleAuth(req, res, next) {
  try {
    if (req.user.role === "ADMIN") {
      return next();
    } else {
      return res.status(403).json({
        message: "Forbidden: You do not have the required permissions.",
      });
    }
  } catch (error) {
    return res.status(500).json({
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
        message: "Forbidden: You do not have the required permissions.",
      });
    }
  } catch (error) {
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
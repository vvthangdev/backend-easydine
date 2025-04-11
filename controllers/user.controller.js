const User = require("../models/user.model.js");
require("dotenv").config();
const userService = require("../services/user.service");
const authUtil = require("../utils/auth.util");
const { Auth } = require("two-step-auth");

const getAllUsers = async (req, res) => {
  try {
    const users = await userService.getAllUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Error fetching users" });
  }
};

const userInfo = async (req, res) => {
  try {
    const user = await User.findOne(
      { username: req.user.username },
      { refresh_token: 0, password: 0 }
    );
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Error fetching user info" });
  }
};

const signUp = async (req, res) => {
  let { email, password, ...otherFields } = req.body;
  if (!password) {
    return res.json({
      status: "FAILED",
      message: "Password is required!",
    });
  }

  try {
    const newUser = await userService.createUser({
      email,
      password,
      ...otherFields,
    });
    return res.json({
      status: "SUCCESS",
      message: "Signup successful!",
      data: newUser.username,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      status: "FAILED",
      message: error.message,
    });
  }
};

const login = async (req, res) => {
  let { email, password } = req.body;
  try {
    const user = await userService.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        status: "FAILED",
        message: "Invalid email or password",
      });
    }

    const isPasswordValid = await userService.validatePassword(
      password,
      user.password
    );
    if (!isPasswordValid) {
      return res.status(401).send("Password incorrect!");
    }

    const dataForAccessToken = {
      username: user.username,
      role: user.role,
    };

    const accessTokenLife = process.env.ACCESS_TOKEN_LIFE;
    const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET;
    const accessToken = await authUtil.generateToken(
      dataForAccessToken,
      accessTokenSecret,
      accessTokenLife
    );
    if (!accessToken) {
      return res.status(401).send("Login not successful!");
    }

    const refreshTokenLife = process.env.REFRESH_TOKEN_LIFE;
    const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET;
    let refreshToken = await authUtil.generateToken(
      dataForAccessToken,
      refreshTokenSecret,
      refreshTokenLife
    );

    if (!user.refresh_token) {
      await userService.updateRefreshToken(user.username, refreshToken);
    } else {
      refreshToken = user.refresh_token;
    }

    if (!refreshToken) {
      return res.status(401).send("Login not successful!");
    }

    res.json({
      id: user._id,
      status: "SUCCESS",
      name: user.name,
      message: "Login successful!",
      role: user.role,
      address: user.address,
      avatar: user.avatar,
      email: user.email,
      username: user.username,
      phone: user.phone,
      accessToken: `Bearer ${accessToken}`,
      refreshToken: `Bearer ${refreshToken}`,
    });
  } catch (error) {
    console.log(error);
    return res.status(401).json({
      success: false,
      status: "FAILED",
      message: "Invalid email or password",
    });
  }
};

const refreshToken = async (req, res) => {
  const refreshToken = req.headers["authorization"]?.split(" ")[1];
  if (!refreshToken) {
    return res.status(403).send("Refresh token is required!");
  }

  try {
    const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET;
    const decoded = await authUtil.verifyToken(
      refreshToken,
      refreshTokenSecret
    );

    const dataForAccessToken = {
      username: decoded.payload.username,
      role: decoded.payload.role,
    };
    const accessTokenLife = process.env.ACCESS_TOKEN_LIFE;
    const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET;
    const newAccessToken = await authUtil.generateToken(
      dataForAccessToken,
      accessTokenSecret,
      accessTokenLife
    );

    res.json({
      status: "SUCCESS",
      accessToken: `Bearer ${newAccessToken}`,
    });
  } catch (error) {
    console.log(error);
    return res.status(403).send("Invalid refresh token!");
  }
};

const logout = async (req, res) => {
  try {
    await userService.updateRefreshToken(req.user.username, null);
    res.json({
      status: "SUCCESS",
      message: "Logout successful!",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).send("An error occurred during logout!");
  }
};

const updateUser = async (req, res) => {
  try {
    const { ...otherFields } = req.body;
    if (!otherFields || Object.keys(otherFields).length === 0) {
      return res.status(400).send("No fields to update.");
    }

    const updatedUser = await userService.updateUser(
      req.user.username,
      otherFields
    );
    if (!updatedUser) {
      return res.status(404).send("User not found!");
    }
    res.json({
      status: "SUCCESS",
      message: "User updated successfully!",
      user: updatedUser,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).send("An error occurred while updating the user!");
  }
};

const deleteUser = async (req, res) => {
  let { password } = req.body;
  try {
    const user = await userService.getUserByUserName(req.user.username);
    const isPasswordValid = await userService.validatePassword(
      password,
      user.password
    );
    if (!isPasswordValid) {
      return res.status(401).send("Password incorrect!");
    }
    await userService.deleteUser(user.username);
    res.json({
      status: "SUCCESS",
      message: "User deleted successfully!",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).send("An error occurred while deleting the user!");
  }
};

const sendOTP = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== "string" || !/\S+@\S+\.\S+/.test(email)) {
      return res
        .status(400)
        .json({ status: "Error", message: "Invalid email address" });
    }

    const res1 = await Auth(email, "");
    console.log("OTP sent successfully:", {
      email: res1.mail,
      success: res1.success,
    });

    return res.status(200).json({
      status: "Success",
      message: "OTP sent successfully",
    });
  } catch (e) {
    console.error("Error in sendOTP:", e);
    return res.status(500).json({
      status: "Error",
      message: "Internal Server Error",
    });
  }
};

const searchUsers = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.trim() === "") {
      return res.status(400).send("Search query is required.");
    }

    const decodedQuery = decodeURIComponent(query.replace(/\+/g, " "));
    const users = await userService.searchUsers(decodedQuery);
    res.status(200).json(users);
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({ error: error.message || "Error searching users" });
  }
};

function removeVietnameseAccents(str) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

module.exports = {
  getAllUsers,
  userInfo,
  signUp,
  login,
  refreshToken,
  logout,
  updateUser,
  deleteUser,
  sendOTP,
  searchUsers, // Thêm hàm tìm kiếm
};

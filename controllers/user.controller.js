const User = require("../models/user.model.js");
// const bcrypt = require("bcrypt");
require("dotenv").config();
const userService = require("../services/user.service");
const authUtil = require("../utils/auth.util");
const { Auth, LoginCredentials } = require("two-step-auth");

const getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Error fetching users" });
  }
};

const userInfo = async (req, res) => {
  try {
    const users = await User.findOne({
      where: { username: req.user.username },
      attributes: { exclude: ["refresh_token", "password"] }, // Loại bỏ refresh_token khỏi kết quả
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Error fetching users" });
  }
};

const signUp = async (req, res) => {
  let { email, password, ...otherFields } = req.body;
  // Kiểm tra password
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
      ...otherFields, // Spread other fields if there are additional fields
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
      // message: "An error occurred during sign up!",
      message: error,
    });
  }
};

const updateUser = async (req, res) => {
  try {
    const { ...otherFields } = req.body; // Adjust as needed to accept relevant fields

    // console.log(req.username)
    // console.log(otherFields);
    if (!otherFields || Object.keys(otherFields).length === 0) {
      return res.status(400).send("No fields to update.");
    }

    // Update the user information in the database
    const updatedUser = await userService.updateUser(req.user.username, {
      ...otherFields, // Spread other fields if there are additional updates
    });

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

const login = async (req, res) => {
  let { email, password } = req.body;
  // console.log(email);
  try {
    const user = await User.findOne({
      where: { email: email },
    });
    // console.log(user);

    const isPasswordValid = await userService.validatePassword(
      password,
      user.password
    );

    console.log(isPasswordValid);
    if (!isPasswordValid) {
      return res.status(401).send("Password incorrect!");
    }

    const dataForAccessToken = {
      username: user.username,
      role: user.role,
      // Thêm các thông tin khác nếu cần
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

    // **Tạo refresh token**
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
      id: user.id,
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

const logout = async (req, res) => {
  // Get the refresh token from the authorization header
  // const accessToken = req.headers["authorization"]?.split(" ")[1];

  // // Check if the refresh token is provided
  // if (!accessToken) {
  //   return res.status(403).send("Access token is required for logout!");
  // }

  try {
    // Decode the refresh token to get the username
    // const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET;
    // const decoded = await authUtil.verifyToken(accessToken, accessTokenSecret);
    // Invalidate the refresh token by clearing it in the database
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

const refreshToken = async (req, res) => {
  // Lấy refresh token từ header
  // const refreshToken = req.headers["authorization"];
  const refreshToken = req.headers["authorization"]?.split(" ")[1];

  // Kiểm tra nếu không có refresh token trong header
  if (!refreshToken) {
    return res.status(403).send("Refresh token is required!");
  }

  try {
    // Lấy secret của refresh token từ biến môi trường
    const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET;

    // Xác minh refresh token
    const decoded = await authUtil.verifyToken(
      refreshToken,
      refreshTokenSecret
    );

    // Tạo data cho access token mới
    const dataForAccessToken = {
      username: decoded.payload.username,
      role: decoded.payload.role,
    };
    // Thiết lập thời gian sống và secret cho access token
    const accessTokenLife = process.env.ACCESS_TOKEN_LIFE;
    const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET;

    // Sinh access token mới
    const newAccessToken = await authUtil.generateToken(
      dataForAccessToken,
      accessTokenSecret,
      accessTokenLife
    );

    // Gửi lại access token mới cho client
    res.json({
      status: "SUCCESS",
      accessToken: `Bearer ${newAccessToken}`,
    });
  } catch (error) {
    console.log(error);
    return res.status(403).send("Invalid refresh token!");
  }
};

const deleteUser = async (req, res) => {
  let { password } = req.body;
  try {
    // Verify the access token to ensure the user is authenticated
    const user = await userService.getUserByUserName(req.user.username);
    console.log(req.user.username);

    const isPasswordValid = await userService.validatePassword(
      password,
      user.password
    );
    console.log(isPasswordValid);
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

    // Validate the email format
    if (!email || typeof email !== "string" || !/\S+@\S+\.\S+/.test(email)) {
      return res
        .status(400)
        .json({ status: "Error", message: "Invalid email address" });
    }

    // Call the Auth function
    const res1 = await Auth(email, "");

    // Log essential details
    console.log("OTP sent successfully:", {
      email: res1.mail,
      success: res1.success,
    });

    // Send success response
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
};

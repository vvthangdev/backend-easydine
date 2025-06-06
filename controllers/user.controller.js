const User = require("../models/user.model.js");
require("dotenv").config();
const userService = require("../services/user.service");
const authUtil = require("../utils/auth.util");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { Auth } = require("two-step-auth");

const getAllUsers = async (req, res) => {
  try {
    const users = await userService.getAllUsers({
      refresh_token: 0, // Loại bỏ refresh_token
      password: 0, // Loại bỏ password
    });

    return res.status(200).json({
      status: "SUCCESS",
      message: "Lấy danh sách người dùng thành công!",
      data: users,
    });
  } catch (error) {
    console.error("Lỗi khi lấy danh sách người dùng:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "Đã xảy ra lỗi khi lấy danh sách người dùng!",
      data: null,
    });
  }
};

const userInfo = async (req, res) => {
  try {
    const user = await User.findOne(
      { username: req.user.username },
      { refresh_token: 0, password: 0 }
    );

    if (!user) {
      return res.status(404).json({
        status: "ERROR",
        message: "Không tìm thấy người dùng!",
        data: null,
      });
    }

    return res.status(200).json({
      status: "SUCCESS",
      message: "Lấy thông tin người dùng thành công!",
      data: user,
    });
  } catch (error) {
    console.error("Lỗi khi lấy thông tin người dùng:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "Đã xảy ra lỗi khi lấy thông tin người dùng!",
      data: null,
    });
  }
};

const signUp = async (req, res) => {
  let { email, password, ...otherFields } = req.body;

  if (!password) {
    return res.status(400).json({
      status: "ERROR",
      message: "Mật khẩu là bắt buộc!",
      data: null,
    });
  }

  try {
    const newUser = await userService.createUser({
      email,
      password,
      ...otherFields,
    });

    return res.status(201).json({
      status: "SUCCESS",
      message: "Đăng ký thành công!",
      data: { username: newUser.username },
    });
  } catch (error) {
    console.error("Lỗi khi đăng ký:", error);
    return res.status(500).json({
      status: "ERROR",
      message: error.message || "Đã xảy ra lỗi khi đăng ký!",
      data: null,
    });
  }
};

const login = async (req, res) => {
  let { email, password } = req.body;

  try {
    const user = await userService.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({
        status: "ERROR",
        message: "Email hoặc mật khẩu không đúng!",
        data: null,
      });
    }

    const isPasswordValid = await userService.validatePassword(
      password,
      user.password
    );
    if (!isPasswordValid) {
      return res.status(401).json({
        status: "ERROR",
        message: "Mật khẩu không đúng!",
        data: null,
      });
    }

    const dataForAccessToken = {
      _id: user._id.toString(), // Thêm _id vào payload
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
      return res.status(401).json({
        status: "ERROR",
        message: "Đăng nhập không thành công!",
        data: null,
      });
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
      return res.status(401).json({
        status: "ERROR",
        message: "Đăng nhập không thành công!",
        data: null,
      });
    }

    return res.status(200).json({
      status: "SUCCESS",
      message: "Đăng nhập thành công!",
      data: {
        id: user._id,
        name: user.name,
        role: user.role,
        address: user.address,
        avatar: user.avatar,
        email: user.email,
        username: user.username,
        phone: user.phone,
        googleId: user.googleId,
        isActive: user.isActive,
        phone: user.phone,
        accessToken: `Bearer ${accessToken}`,
        refreshToken: `Bearer ${refreshToken}`,
      },
    });
  } catch (error) {
    console.error("Lỗi khi đăng nhập:", error);
    return res.status(401).json({
      status: "ERROR",
      message: "Email hoặc mật khẩu không đúng!",
      data: null,
    });
  }
};

const refreshToken = async (req, res) => {
  const {refreshToken} = req.body;
  // console.log(`vvt check refreshtoken: ${refreshToken}`)

  if (!refreshToken) {
    return res.status(403).json({
      status: "ERROR",
      message: "Refresh token là bắt buộc!",
      data: null,
    });
  }

  try {
    const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET;
    const decoded = await authUtil.verifyToken(
      refreshToken,
      refreshTokenSecret
    );

    const user = await User.findOne({ username: decoded.payload.username });
    if (!user) {
      return res.status(404).json({
        status: "ERROR",
        message: "Không tìm thấy người dùng!",
        data: null,
      });
    }

    const dataForAccessToken = {
      _id: user._id.toString(), // Thêm _id vào payload
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

    return res.status(200).json({
      status: "SUCCESS",
      message: "Làm mới token thành công!",
      data: { accessToken: `Bearer ${newAccessToken}` },
    });
  } catch (error) {
    console.error("Lỗi khi làm mới token:", error);
    return res.status(403).json({
      status: "ERROR",
      message: "Refresh token không hợp lệ!",
      data: null,
    });
  }
};

const logout = async (req, res) => {
  try {
    await userService.updateRefreshToken(req.user.username, null);

    return res.status(200).json({
      status: "SUCCESS",
      message: "Đăng xuất thành công!",
      data: null,
    });
  } catch (error) {
    console.error("Lỗi khi đăng xuất:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "Đã xảy ra lỗi khi đăng xuất!",
      data: null,
    });
  }
};

const updateUser = async (req, res) => {
  try {
    const { ...otherFields } = req.body;

    if (!otherFields || Object.keys(otherFields).length === 0) {
      return res.status(400).json({
        status: "ERROR",
        message: "Không có trường nào để cập nhật!",
        data: null,
      });
    }

    const updatedUser = await userService.updateUser(
      req.user.username,
      otherFields,
      { refresh_token: 0, password: 0 }
    );
    if (!updatedUser) {
      return res.status(404).json({
        status: "ERROR",
        message: "Không tìm thấy người dùng!",
        data: null,
      });
    }

    return res.status(200).json({
      status: "SUCCESS",
      message: "Cập nhật người dùng thành công!",
      data: null,
    });
  } catch (error) {
    console.error("Lỗi khi cập nhật người dùng:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "Đã xảy ra lỗi khi cập nhật người dùng!",
      data: null,
    });
  }
};

const deleteUser = async (req, res) => {
  let { password } = req.body;

  try {
    const user = await userService.getUserByUserName(req.user.username);
    if (!user) {
      return res.status(404).json({
        status: "ERROR",
        message: "Không tìm thấy người dùng!",
        data: null,
      });
    }

    const isPasswordValid = await userService.validatePassword(
      password,
      user.password
    );
    if (!isPasswordValid) {
      return res.status(401).json({
        status: "ERROR",
        message: "Mật khẩu không đúng!",
        data: null,
      });
    }

    await userService.deleteUser(user.username);

    return res.status(200).json({
      status: "SUCCESS",
      message: "Xóa người dùng thành công!",
      data: null,
    });
  } catch (error) {
    console.error("Lỗi khi xóa người dùng:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "Đã xảy ra lỗi khi xóa người dùng!",
      data: null,
    });
  }
};

const sendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== "string" || !/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({
        status: "ERROR",
        message: "Địa chỉ email không hợp lệ!",
        data: null,
      });
    }

    const res1 = await Auth(email, "");
    console.log("Gửi OTP thành công:", {
      email: res1.mail,
      success: res1.success,
    });

    return res.status(200).json({
      status: "SUCCESS",
      message: "Gửi OTP thành công!",
      data: null,
    });
  } catch (error) {
    console.error("Lỗi khi gửi OTP:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "Đã xảy ra lỗi khi gửi OTP!",
      data: null,
    });
  }
};

const searchUsers = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.trim() === "") {
      return res.status(400).json({
        status: "ERROR",
        message: "Chuỗi tìm kiếm là bắt buộc!",
        data: null,
      });
    }

    const decodedQuery = decodeURIComponent(query.replace(/\+/g, " "));
    const users = await userService.searchUsers(decodedQuery);

    return res.status(200).json({
      status: "SUCCESS",
      message: "Tìm kiếm người dùng thành công!",
      data: users,
    });
  } catch (error) {
    console.error("Lỗi khi tìm kiếm người dùng:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "Đã xảy ra lỗi khi tìm kiếm người dùng!",
      data: null,
    });
  }
};

const getUserById = async (req, res) => {
  try {
    const { id } = req.body;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: "ERROR",
        message: "ID người dùng hợp lệ là bắt buộc!",
        data: null,
      });
    }

    const user = await User.findById(id, { refresh_token: 0, password: 0 });
    if (!user) {
      return res.status(404).json({
        status: "ERROR",
        message: "Không tìm thấy người dùng!",
        data: null,
      });
    }

    return res.status(200).json({
      status: "SUCCESS",
      message: "Lấy thông tin người dùng thành công!",
      data: {
        _id: user._id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role,
        address: user.address,
        avatar: user.avatar,
        phone: user.phone,
      },
    });
  } catch (error) {
    console.error("Lỗi khi lấy người dùng theo ID:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "Đã xảy ra lỗi khi lấy thông tin người dùng!",
      data: null,
    });
  }
};

const googleLoginCallback = async (req, res) => {
  try {
    const user = req.user;

    const dataForAccessToken = {
      _id: user._id.toString(), // Thêm _id vào payload
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

    const redirectUrl = `${
      process.env.FRONTEND_URL
    }/login?accessToken=${accessToken}&refreshToken=${refreshToken}&userData=${encodeURIComponent(
      JSON.stringify({
        id: user._id,
        name: user.name,
        role: user.role,
        address: user.address,
        avatar: user.avatar,
        email: user.email,
        username: user.username,
        phone: user.phone,
      })
    )}`;
    return res.redirect(redirectUrl);
  } catch (error) {
    console.error("Lỗi khi đăng nhập Google:", error);
    return res.redirect(
      `${process.env.FRONTEND_URL}/login?error=google_login_failed`
    );
  }
};

const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        status: "ERROR",
        message: "Mật khẩu cũ và mới là bắt buộc!",
        data: null,
      });
    }

    const user = await User.findOne({ username: req.user.username });
    if (!user) {
      return res.status(404).json({
        status: "ERROR",
        message: "Không tìm thấy người dùng!",
        data: null,
      });
    }

    if (user.googleId && !user.password) {
      return res.status(400).json({
        status: "ERROR",
        message: "Tài khoản Google không thể đổi mật khẩu theo cách này!",
        data: null,
      });
    }

    const isPasswordValid = await userService.validatePassword(
      oldPassword,
      user.password
    );
    if (!isPasswordValid) {
      return res.status(401).json({
        status: "ERROR",
        message: "Mật khẩu cũ không đúng!",
        data: null,
      });
    }

    const saltRounds = 10;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);
    await userService.updateUser(req.user.username, {
      password: hashedNewPassword,
    });

    return res.status(200).json({
      status: "SUCCESS",
      message: "Đổi mật khẩu thành công!",
      data: null,
    });
  } catch (error) {
    console.error("Lỗi khi đổi mật khẩu:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "Đã xảy ra lỗi khi đổi mật khẩu!",
      data: null,
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
  searchUsers,
  getUserById,
  googleLoginCallback,
  changePassword,
};

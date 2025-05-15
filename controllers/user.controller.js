const User = require("../models/user.model.js");
require("dotenv").config();
const userService = require("../services/user.service");
const authUtil = require("../utils/auth.util");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { Auth } = require("two-step-auth");

const getAllUsers = async (req, res) => {
  try {
    const users = await userService.getAllUsers();

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
  const refreshToken = req.headers["authorization"]?.split(" ")[1];

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
      otherFields
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
      data: updatedUser,
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
    const { id } = req.params;

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

const updateUserByAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, password, username, name, phone, role, address, avatar } =
      req.body;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: "ERROR",
        message: "ID người dùng hợp lệ là bắt buộc!",
        data: null,
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        status: "ERROR",
        message: "Không tìm thấy người dùng!",
        data: null,
      });
    }

    const updateData = {};
    if (email) updateData.email = email;
    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;
    if (address) updateData.address = address;
    if (avatar) updateData.avatar = avatar;
    if (username) updateData.username = username;
    if (role && ["ADMIN", "STAFF", "CUSTOMER"].includes(role)) {
      updateData.role = role;
    }
    if (password) {
      const saltRounds = 10;
      updateData.password = await bcrypt.hash(password, saltRounds);
    }

    if (email || username) {
      const existingUser = await User.findOne({
        $or: [{ email: updateData.email }, { username: updateData.username }],
        _id: { $ne: id },
      });
      if (existingUser) {
        return res.status(400).json({
          status: "ERROR",
          message: "Email hoặc tên người dùng đã tồn tại!",
          data: null,
        });
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, select: "-password -refresh_token" }
    );

    return res.status(200).json({
      status: "SUCCESS",
      message: "Cập nhật người dùng bởi admin thành công!",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Lỗi khi cập nhật người dùng bởi admin:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "Đã xảy ra lỗi khi cập nhật người dùng!",
      data: null,
    });
  }
};

const googleLoginCallback = async (req, res) => {
  try {
    const user = req.user;

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
      process.env.FE_URL || "http://localhost:3000"
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
      `${
        process.env.FE_URL || "http://localhost:3000"
      }/login?error=google_login_failed`
    );
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
  updateUserByAdmin,
  googleLoginCallback,
};

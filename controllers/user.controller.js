const admin = require("firebase-admin");
const User = require("../models/user.model.js");
require("dotenv").config();
const userService = require("../services/user.service");
const authUtil = require("../utils/auth.util");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { Auth } = require("two-step-auth");
const userDto = require("../dtos/user.dto.js")

const getAllUsers = async (req, res) => {
  try {
    const users = await userService.getAllUsers({
      refresh_token: 0,
      password: 0,
    });

    return res.status(200).json({
      status: "SUCCESS",
      message: "Lấy danh sách người dùng thành công!",
      data: users.map(userDto.userResponseDTO), // Chuẩn hóa đầu ra
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
      data: userDto.userResponseDTO(user), // Chuẩn hóa đầu ra
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
  try {
    // Validate dữ liệu đầu vào
    const { error, value } = userDto.signUpSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        status: "ERROR",
        message: error.details[0].message,
        data: null,
      });
    }

    const newUser = await userService.createUser({
      email: value.email,
      password: value.password,
      username: value.username,
      name: value.name,
      address: value.address,
      phone: value.phone,
    });

    return res.status(201).json({
      status: "SUCCESS",
      message: "Đăng ký thành công!",
      data: userDto.userResponseDTO(newUser), // Chuẩn hóa đầu ra
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
  try {
    // Validate dữ liệu đầu vào
    const { error, value } = userDto.loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        status: "ERROR",
        message: error.details[0].message,
        data: null,
      });
    }

    const user = await userService.getUserByEmail(value.email);
    if (!user) {
      return res.status(401).json({
        status: "ERROR",
        message: "Email hoặc mật khẩu không đúng!",
        data: null,
      });
    }

    const isPasswordValid = await userService.validatePassword(
      value.password,
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
      _id: user._id.toString(),
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
        ...userDto.userResponseDTO(user), // Chuẩn hóa dữ liệu người dùng
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
  try {
    // Validate dữ liệu đầu vào
    const { error, value } = userDto.refreshTokenSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        status: "ERROR",
        message: error.details[0].message,
        data: null,
      });
    }

    const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET;
    const decoded = await authUtil.verifyToken(
      value.refreshToken.replace("Bearer ", ""), // Loại bỏ "Bearer " nếu có
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
      _id: user._id.toString(),
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
    // Validate dữ liệu đầu vào
    const { error, value } = userDto.updateUserSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        status: "ERROR",
        message: error.details[0].message,
        data: null,
      });
    }

    const updatedUser = await userService.updateUser(
      req.user.username,
      value,
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
      data: userDto.userResponseDTO(updatedUser), // Chuẩn hóa đầu ra
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
  try {
    // Validate dữ liệu đầu vào (mật khẩu bắt buộc)
    const { error, value } = Joi.object({
      password: Joi.string().min(8).required(),
    }).validate(req.body);
    if (error) {
      return res.status(400).json({
        status: "ERROR",
        message: error.details[0].message,
        data: null,
      });
    }

    const user = await userService.getUserByUserName(req.user.username);
    if (!user) {
      return res.status(404).json({
        status: "ERROR",
        message: "Không tìm thấy người dùng!",
        data: null,
      });
    }

    const isPasswordValid = await userService.validatePassword(
      value.password,
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
      // Validate dữ liệu đầu vào
      const { error, value } = userDto.sendOTPSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          status: "ERROR",
          message: error.details[0].message,
          data: null,
        });
      }
  
      const res1 = await Auth(value.email, "");
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
      // Validate dữ liệu đầu vào (query)
      const { error, value } = userDto.searchUsersSchema.validate(req.query);
      if (error) {
        return res.status(400).json({
          status: "ERROR",
          message: error.details[0].message,
          data: null,
        });
      }
  
      const decodedQuery = decodeURIComponent(value.query.replace(/\+/g, " "));
      const users = await userService.searchUsers(decodedQuery);
  
      return res.status(200).json({
        status: "SUCCESS",
        message: "Tìm kiếm người dùng thành công!",
        data: users.map(userDto.userResponseDTO), // Chuẩn hóa đầu ra
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
      // Validate dữ liệu đầu vào
      const { error, value } = userDto.adminGetUserInfoSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          status: "ERROR",
          message: error.details[0].message,
          data: null,
        });
      }
  
      const user = await User.findById(value.id, { refresh_token: 0, password: 0 });
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
        data: userDto.userResponseDTO(user), // Chuẩn hóa đầu ra
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
      _id: user._id.toString(),
      username: user.username,
      role: user.role,
    };

    const accessToken = await authUtil.generateToken(
      dataForAccessToken,
      process.env.ACCESS_TOKEN_SECRET,
      process.env.ACCESS_TOKEN_LIFE
    );

    let refreshToken = user.refresh_token || await authUtil.generateToken(
      dataForAccessToken,
      process.env.REFRESH_TOKEN_SECRET,
      process.env.REFRESH_TOKEN_LIFE
    );

    if (!user.refresh_token) {
      await userService.updateRefreshToken(user.username, refreshToken);
    }

    const userData = userDto.userResponseDTO(user); // Chuẩn hóa dữ liệu
    const redirectUrl = `${
      process.env.FRONTEND_URL
    }/login?accessToken=${accessToken}&refreshToken=${refreshToken}&userData=${encodeURIComponent(
      JSON.stringify(userData)
    )}`;
    return res.redirect(redirectUrl);
  } catch (error) {
    console.error("Lỗi khi đăng nhập Google:", error);
    return res.redirect(`${process.env.FRONTEND_URL}/login?error=google_login_failed`);
  }
};

const changePassword = async (req, res) => {
  try {
    // Validate dữ liệu đầu vào
    const { error, value } = userDto.changePasswordSchema.validate(req.body);
    if (error) return res.status(400).json({ status: "ERROR", message: error.details[0].message, data: null });

    const user = await User.findOne({ username: req.user.username });
    if (!user) return res.status(404).json({ status: "ERROR", message: "Không tìm thấy người dùng!", data: null });

    if (user.googleId && !user.password) {
      return res.status(400).json({ status: "ERROR", message: "Tài khoản Google không thể đổi mật khẩu!", data: null });
    }

    const isPasswordValid = await userService.validatePassword(value.oldPassword, user.password);
    if (!isPasswordValid) return res.status(401).json({ status: "ERROR", message: "Mật khẩu cũ không đúng!", data: null });

    const hashedNewPassword = await bcrypt.hash(value.newPassword, 10);
    await userService.updateUser(req.user.username, { password: hashedNewPassword });

    return res.status(200).json({
      status: "SUCCESS",
      message: "Đổi mật khẩu thành công!",
      data: null,
    });
  } catch (error) {
    console.error("Lỗi khi đổi mật khẩu:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "Lỗi khi đổi mật khẩu!",
      data: null,
    });
  }
};

const googleFirebaseLogin = async (req, res) => {
    console.log("Google Firebase Login request:", req.body);
    try {
        const { idToken } = req.body;
        if (!idToken) {
            console.error("Missing idToken");
            return res.status(400).json({
                status: "ERROR",
                message: "Missing idToken",
                data: null,
            });
        }

        console.log("Verifying idToken...");
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        console.log("Decoded token:", decodedToken);
        const { email, name, sub: googleId } = decodedToken;

        // Kiểm tra người dùng bằng googleId hoặc email
        let user = await User.findOne({
            $or: [{ googleId }, { email }],
        });

        if (!user) {
            console.log("Creating new user with data:", {
                email,
                name,
                googleId,
                username: email.split("@")[0],
                password: "12345678",
                isActive: true,
            });
            user = await userService.createUser({
                email,
                name,
                googleId,
                username: email.split("@")[0],
                password: "12345678",
                isActive: true,
            });
            console.log("New user created:", user);
        } else if (!user.googleId) {
            // Nếu tài khoản tồn tại qua email nhưng không có googleId, liên kết googleId
            console.log(`Linking Google ID to existing user with email: ${email}`);
            user.googleId = googleId;
            await user.save();
        }

        const dataForAccessToken = {
            _id: user._id.toString(),
            username: user.username,
            role: user.role,
        };

        const accessToken = await authUtil.generateToken(
            dataForAccessToken,
            process.env.ACCESS_TOKEN_SECRET,
            process.env.ACCESS_TOKEN_LIFE
        );

        let refreshToken =
            user.refresh_token ||
            (await authUtil.generateToken(
                dataForAccessToken,
                process.env.REFRESH_TOKEN_SECRET,
                process.env.REFRESH_TOKEN_LIFE
            ));

        if (!user.refresh_token) {
            await userService.updateRefreshToken(user.username, refreshToken);
        }

        const userData = userDto.userResponseDTO(user);
        return res.status(200).json({
            status: "SUCCESS",
            message: "Google login successful!",
            data: {
                ...userData,
                accessToken: `Bearer ${accessToken}`,
                refreshToken: `Bearer ${refreshToken}`,
            },
        });
    } catch (error) {
        console.error("Error in Google Firebase login:", error);
        return res.status(500).json({
            status: "ERROR",
            message: "Error in Google Firebase login",
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
  googleFirebaseLogin,
};

const User = require("../models/user.model.js");
require("dotenv").config();
const userService = require("../services/user.service");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");

const deleteUserByAdmin = async (req, res) => {
  try {
    const { id, username } = req.body;

    if (!id && !username) {
      return res.status(400).json({
        status: "ERROR",
        message: "ID hoặc username là bắt buộc trong body!",
        data: null,
      });
    }

    let user;
    if (id) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          status: "ERROR",
          message: "ID người dùng không hợp lệ!",
          data: null,
        });
      }
      user = await User.findByIdAndDelete(id);
    } else {
      user = await userService.getUserByUserName(username);
      if (user) {
        await userService.deleteUser(username);
      }
    }

    if (!user) {
      return res.status(404).json({
        status: "ERROR",
        message: "Không tìm thấy người dùng!",
        data: null,
      });
    }

    return res.status(200).json({
      status: "SUCCESS",
      message: "Xóa người dùng thành công!",
      data: null,
    });
  } catch (error) {
    console.error("Lỗi khi xóa người dùng bởi admin:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "Đã xảy ra lỗi khi xóa người dùng!",
      data: null,
    });
  }
};

const updateUserByAdmin = async (req, res) => {
  try {
    const { id, username, password, role, ...userInfo } = req.body;

    if (!id && !username) {
      return res.status(400).json({
        status: "ERROR",
        message: "ID hoặc username là bắt buộc trong body!",
        data: null,
      });
    }

    let user;
    if (id) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          status: "ERROR",
          message: "ID người dùng không hợp lệ!",
          data: null,
        });
      }
      user = await User.findById(id);
    } else {
      user = await userService.getUserByUserName(username);
    }

    if (!user) {
      return res.status(404).json({
        status: "ERROR",
        message: "Không tìm thấy người dùng!",
        data: null,
      });
    }

    const updateData = { ...userInfo };
    if (role && ["ADMIN", "STAFF", "CUSTOMER"].includes(role)) {
      updateData.role = role;
    }
    if (password) {
      const saltRounds = 10;
      updateData.password = await bcrypt.hash(password, saltRounds);
    }

    if (userInfo.email || userInfo.username) {
      const existingUser = await User.findOne({
        $or: [
          { email: updateData.email },
          { username: updateData.username },
        ],
        _id: { $ne: id || user._id },
      });
      if (existingUser) {
        return res.status(400).json({
          status: "ERROR",
          message: "Email hoặc tên người dùng đã tồn tại!",
          data: null,
        });
      }
    }

    let updatedUser;
    if (id) {
      updatedUser = await User.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, select: "-password -refresh_token" }
      );
    } else {
      updatedUser = await userService.updateUser(user.username, updateData);
    }

    if (!updatedUser) {
      return res.status(404).json({
        status: "ERROR",
        message: "Không tìm thấy người dùng!",
        data: null,
      });
    }

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

const deactivateUser = async (req, res) => {
  try {
    const { id } = req.body;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: "ERROR",
        message: "ID người dùng hợp lệ là bắt buộc trong body!",
        data: null,
      });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
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
      message: "Khóa tài khoản thành công!",
      data: user,
    });
  } catch (error) {
    console.error("Lỗi khi khóa tài khoản:", error);
    return res.status(500).json({
      status: "ERROR",
      message: error.message || "Đã xảy ra lỗi khi khóa tài khoản!",
      data: null,
    });
  }
};

const activateUser = async (req, res) => {
  try {
    const { id } = req.body;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: "ERROR",
        message: "ID người dùng hợp lệ là bắt buộc trong body!",
        data: null,
      });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { isActive: true },
      { new: true }
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
      message: "Mở khóa tài khoản thành công!",
      data: user,
    });
  } catch (error) {
    console.error("Lỗi khi mở khóa tài khoản:", error);
    return res.status(500).json({
      status: "ERROR",
      message: error.message || "Đã xảy ra lỗi khi mở khóa tài khoản!",
      data: null,
    });
  }
};

const adminGetUserInfo = async (req, res) => {
  try {
    const customerId = req.query.id;

    if (!customerId) {
      return res.status(400).json({
        status: "ERROR",
        message: "Customer ID is required!",
        data: null,
      });
    }

    const customer = await userService.getUserByUserId(customerId);
    if (!customer) {
      return res.status(404).json({
        status: "ERROR",
        message: "Customer not found!",
        data: null,
      });
    }

    return res.status(200).json({
      status: "SUCCESS",
      message: "Customer information retrieved successfully!",
      data: customer,
    });
  } catch (error) {
    console.error("Error fetching customer info:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "An error occurred while fetching customer information!",
      data: null,
    });
  }
};

module.exports = {
  deleteUserByAdmin,
  updateUserByAdmin,
  deactivateUser,
  activateUser,
  adminGetUserInfo,
};
// controllers/user.controller.js
const User = require("../models/user.model.js");
const OrderDetail = require("../models/order_detail.model.js");
require("dotenv").config();
const userService = require("../services/user.service");
const { getIO } = require("../socket/socket.js");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const userDto = require("../dtos/user.dto");
const moment = require('moment');
const socket = require("../socket/socket");

const createUserByAdmin = async (req, res) => {
  try {
    // Validate dữ liệu đầu vào
    const { error, value } = userDto.createUserByAdminSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        status: "ERROR",
        message: error.details[0].message,
        data: null,
      });
    }

    // Kiểm tra sự tồn tại của username hoặc email
    const existingUser = await User.findOne({
      $or: [{ username: value.username }, { email: value.email }],
    });
    if (existingUser) {
      return res.status(400).json({
        status: "ERROR",
        message: "Username hoặc email đã tồn tại!",
        data: null,
      });
    }

    // Mã hóa mật khẩu
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(value.password, saltRounds);

    // Tạo dữ liệu người dùng mới
    const userData = {
      username: value.username,
      email: value.email,
      password: hashedPassword,
      name: value.name || "",
      phone: value.phone || "",
      address: value.address || "",
      role: value.role || "CUSTOMER",
      avatar: value.avatar || "",
      isActive: true,
    };

    const newUser = await userService.createUser(userData);

    return res.status(201).json({
      status: "SUCCESS",
      message: "Tạo người dùng thành công!",
      data: userDto.userResponseDTO(newUser),
    });
  } catch (error) {
    console.error("Lỗi khi tạo người dùng bởi admin:", error);
    return res.status(500).json({
      status: "ERROR",
      message: error.message || "Đã xảy ra lỗi khi tạo người dùng!",
      data: null,
    });
  }
};

const deleteUserByAdmin = async (req, res) => {
  try {
    // Validate dữ liệu đầu vào
    const { error, value } = userDto.deleteUserByAdminSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        status: "ERROR",
        message: error.details[0].message,
        data: null,
      });
    }

    let user;
    if (value.id) {
      user = await User.findByIdAndDelete(value.id);
    } else {
      user = await userService.getUserByUserName(value.username);
      if (user) {
        await userService.deleteUser(value.username);
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
    // Validate dữ liệu đầu vào
    const { error, value } = userDto.updateUserByAdminSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        status: "ERROR",
        message: error.details[0].message,
        data: null,
      });
    }

    let user;
    if (value.id) {
      user = await User.findById(value.id);
    } else {
      user = await userService.getUserByUserName(value.username);
    }

    if (!user) {
      return res.status(404).json({
        status: "ERROR",
        message: "Không tìm thấy người dùng!",
        data: null,
      });
    }

    const updateData = {
      name: value.name,
      email: value.email,
      phone: value.phone,
      address: value.address,
      avatar: value.avatar,
      role: value.role,
    };

    if (value.password) {
      const saltRounds = 10;
      updateData.password = await bcrypt.hash(value.password, saltRounds);
    }

    // Kiểm tra email hoặc username trùng lặp
    if (value.email || value.username) {
      const existingUser = await User.findOne({
        $or: [{ email: value.email }, { username: value.username }],
        _id: { $ne: value.id || user._id },
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
    if (value.id) {
      updatedUser = await User.findByIdAndUpdate(
        value.id,
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
      data: userDto.userResponseDTO(updatedUser),
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
    // Validate dữ liệu đầu vào
    const { error, value } = userDto.toggleUserStatusSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        status: "ERROR",
        message: error.details[0].message,
        data: null,
      });
    }

    const user = await User.findByIdAndUpdate(
      value.id,
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
      data: userDto.userResponseDTO(user),
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
    // Validate dữ liệu đầu vào
    const { error, value } = userDto.toggleUserStatusSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        status: "ERROR",
        message: error.details[0].message,
        data: null,
      });
    }

    const user = await User.findByIdAndUpdate(
      value.id,
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
      data: userDto.userResponseDTO(user),
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
    // Validate dữ liệu đầu vào (query)
    const { error, value } = userDto.adminGetUserInfoSchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        status: "ERROR",
        message: error.details[0].message,
        data: null,
      });
    }

    const customer = await userService.getUserByUserId(value.id);
    if (!customer) {
      return res.status(404).json({
        status: "ERROR",
        message: "Không tìm thấy người dùng!",
        data: null,
      });
    }

    return res.status(200).json({
      status: "SUCCESS",
      message: "Lấy thông tin người dùng thành công!",
      data: userDto.userResponseDTO(customer),
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

const getAllStaff = async (req, res) => {
  try {
    const staff = await User.find({ role: { $in: ["ADMIN", "STAFF"] } });
    return res.status(200).json({
      status: "SUCCESS",
      message: "Lấy danh sách nhân viên thành công!",
      data: staff.map(userDto.userResponseDTO),
    });
  } catch (error) {
    console.error("Lỗi khi lấy danh sách nhân viên:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "Đã xảy ra lỗi khi lấy danh sách nhân viên!",
      data: null,
    });
  }
};


const handlePaymentWebhook = async (req, res) => {
  try {
    // Chuyển đổi định dạng ngày nếu có
    if (req.body.ngayDienRa) {
      const parsedDate = moment(req.body.ngayDienRa, "DD/MM/YYYY HH:mm", true);
      if (parsedDate.isValid()) {
        req.body.ngayDienRa = parsedDate.toISOString();
      } else {
        return res.status(400).json({
          status: "ERROR",
          message: '"ngayDienRa" must be in format DD/MM/YYYY HH:mm',
        });
      }
    }

    // Xử lý trường giaTri để loại bỏ " VND" và dấu chấm
    if (req.body.giaTri && typeof req.body.giaTri === 'string') {
      req.body.giaTri = parseFloat(req.body.giaTri.replace(/[^\d]/g, '')); // Chuyển "185.000 VND" thành 185000
    }

    // Xử lý trường soTaiKhoan để loại bỏ dấu nháy đơn và đổi tên thành soTaiKhoanDoiUng
    if (req.body.soTaiKhoan && typeof req.body.soTaiKhoan === 'string') {
      req.body.soTaiKhoanDoiUng = req.body.soTaiKhoan.replace(/['"]/g, '');
      delete req.body.soTaiKhoan; // Xóa trường soTaiKhoan sau khi xử lý
    }

    // Log dữ liệu đầu vào sau khi xử lý
    console.log(`[${new Date().toISOString()}] [Webhook] Processed request body:`, req.body);

    // Validate dữ liệu đầu vào
    const { error, value } = userDto.paymentWebhookSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        status: "ERROR",
        message: error.details[0].message,
      });
    }

    const order = await OrderDetail.findById(value.orderId);
    if (!order) {
      console.log(`[${new Date().toISOString()}] [Webhook] Order ${value.orderId} not found, still sending notification to adminRoom`);
    }

    // Tạo thông báo Socket.IO
    const notification = {
      id: `notif_${Date.now()}`,
      type: "PAYMENT_SUCCESS",
      title: "Thanh toán đơn hàng thành công",
      message: order && order.type === "reservation" && order.tableDetails?.length
        ? `Thanh toán thành công cho đơn hàng ${value.orderId} tại bàn ${order.tableDetails[0]?.table_number || "N/A"} (${order.tableDetails[0]?.area || "N/A"}) với số tiền ${value.giaTri}`
        : `Thanh toán thành công cho đơn hàng ${value.orderId} (${order?.type === "takeaway" ? "Mang đi" : "Tại chỗ"}) với số tiền ${value.giaTri}`,
      data: {
        orderId: value.orderId,
        amount: value.giaTri,
        transactionTime: value.ngayDienRa,
        maGD: value.maGD || "N/A",
        moTa: value.moTa || "N/A",
        maThamChieu: value.maThamChieu || null
      },
      timestamp: new Date().toISOString(),
      action: {
        label: "Xem chi tiết",
        type: "VIEW_DETAILS",
        payload: { orderId: value.orderId }
      },
    };

    // Gửi thông báo qua Socket.IO
    const io = getIO();
    console.log(`[${new Date().toISOString()}] [Webhook] Emitting PAYMENT_SUCCESS notification:`, JSON.stringify(notification, null, 2));
    io.to("adminRoom").emit("notification", notification);
    if (order?.customer_id) {
      io.to(`user:${order.customer_id}`).emit("notification", notification);
      console.log(`[${new Date().toISOString()}] [Webhook] Sent notification to user:${order.customer_id}`);
    } else {
      console.log(`[${new Date().toISOString()}] [Webhook] No customerId found for order ${value.orderId}`);
    }

    // Trả về toàn bộ dữ liệu từ value, thêm customerId từ order nếu có
    return res.status(200).json({
      status: "OK",
      message: "Webhook received and notification sent",
      data: {
        ...value,
        customerId: order?.customer_id?.toString() || null
      }
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] [Webhook] Error processing webhook:`, error.message);
    return res.status(500).json({
      status: "ERROR",
      message: "Failed to process webhook",
    });
  }
};

module.exports = {
  createUserByAdmin,
  deleteUserByAdmin,
  updateUserByAdmin,
  deactivateUser,
  activateUser,
  adminGetUserInfo,
  getAllStaff,
  handlePaymentWebhook,
};
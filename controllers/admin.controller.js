const User = require("../models/user.model.js");
const OrderDetail = require("../models/order_detail.model.js")
require("dotenv").config();
const userService = require("../services/user.service");
const { getIO } = require("../socket/socket.js")
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");

const createUserByAdmin = async (req, res) => {
  try {
    const {
      username,
      email,
      password,
      name,
      phone,
      address,
      role,
      avatar
    } = req.body;

    // Kiểm tra các trường bắt buộc
    if (!username || !email || !password) {
      return res.status(400).json({
        status: "ERROR",
        message: "Username, email và password là bắt buộc!",
        data: null,
      });
    }

    // Kiểm tra định dạng email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        status: "ERROR",
        message: "Email không hợp lệ!",
        data: null,
      });
    }

    // Kiểm tra độ dài mật khẩu
    if (password.length < 8) {
      return res.status(400).json({
        status: "ERROR",
        message: "Mật khẩu phải có ít nhất 8 ký tự!",
        data: null,
      });
    }

    // Kiểm tra vai trò hợp lệ
    if (role && !["ADMIN", "STAFF", "CUSTOMER"].includes(role)) {
      return res.status(400).json({
        status: "ERROR",
        message: "Vai trò không hợp lệ! Phải là ADMIN, STAFF hoặc CUSTOMER.",
        data: null,
      });
    }

    // Kiểm tra sự tồn tại của username hoặc email
    const existingUser = await User.findOne({
      $or: [{ username }, { email }],
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
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Tạo dữ liệu người dùng mới
    const userData = {
      username,
      email,
      password: hashedPassword,
      name: name || "",
      phone: phone || "",
      address: address || "",
      role: role || "CUSTOMER",
      avatar: avatar || "",
      isActive: true,
    };

    await userService.createUser(userData);

    return res.status(201).json({
      status: "SUCCESS",
      message: "Tạo người dùng thành công!",
      data: "",
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

const getAllStaff = async (req, res) => {
  try {
    const staff = await User.find({ role: { $in: ["ADMIN", "STAFF"] } });
    return res.status(200).json({
      status: "SUCCESS",
      message: "Lấy danh sách người dùng thành công!",
      data: staff,
    });
  } catch (error) {
    return res.status(500).json({
      status: "ERROR",
      message: "Lỗi khi lấy danh sách người dùng!",
      data: null,
    });
  }
};

const handlePaymentWebhook = async (req, res) => {
  try {
    // Dữ liệu webhook gửi về là một mảng, lấy object đầu tiên
    const webhookData = req.body;
    console.log(webhookData)
    if (!webhookData) {
      return res.status(400).json({
        status: "ERROR",
        message: "Invalid webhook data format",
      });
    }

    const { orderId, tenTaiKhoanDoiUng, soTaiKhoanDoiUng, ngayDienRa, giaTri } = webhookData;

    // Kiểm tra dữ liệu đầu vào
    if (!orderId || !giaTri || !ngayDienRa) {
      return res.status(400).json({
        status: "ERROR",
        message: "orderId, giaTri, và ngayDienRa là bắt buộc!",
      });
    }

    // Lấy customerId từ database dựa trên orderId
    const order = await OrderDetail.findById(orderId);
    if (!order) {
      console.log(`[${new Date().toISOString()}] [Webhook] Order ${orderId} not found, still sending notification to adminRoom`);
    }

    // Tạo thông báo
    const notification = {
      type: "PAYMENT_SUCCESS",
      orderId,
      customerId: order?.customer_id?.toString() || null,
      accountName: tenTaiKhoanDoiUng || "Unknown",
      accountNumber: soTaiKhoanDoiUng || "N/A",
      transactionTime: ngayDienRa,
      amount: giaTri,
      message: `Payment successful for order ${orderId} at ${ngayDienRa} with amount ${giaTri}`,
      createdAt: new Date().toISOString(),
    };

    // Gửi thông báo qua Socket.IO
    const io = getIO();
    console.log(`[${new Date().toISOString()}] [Webhook] Sending paymentSuccess notification:`, notification);

    // Gửi đến adminRoom
    io.to("adminRoom").emit("paymentSuccess", notification);

    // Gửi đến khách hàng nếu có customerId
    if (order?.customer_id) {
      io.to(`user:${order.customer_id}`).emit("paymentSuccess", notification);
    } else {
      console.log(`[${new Date().toISOString()}] [Webhook] No customerId found for order ${orderId}`);
    }

    return res.status(200).json({
      status: "OK",
      message: "Webhook received and notification sent",
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
  handlePaymentWebhook
};
// dtos/user.dto.js
const Joi = require('joi');

// Schema cho làm mới token
const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

// Schema cho gửi OTP
const sendOTPSchema = Joi.object({
  email: Joi.string().email().required(),
});

// Schema cho tìm kiếm người dùng
const searchUsersSchema = Joi.object({
  query: Joi.string().min(1).required(),
});

// Schema cho đăng ký
const signUpSchema = Joi.object({
  username: Joi.string().min(3).max(30).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  name: Joi.string().optional().allow(''),
  address: Joi.string().optional().allow(''),
  phone: Joi.string().optional().allow(''),
});

// Schema cho đăng nhập
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
});

// Schema cho cập nhật người dùng
const updateUserSchema = Joi.object({
  name: Joi.string().optional().allow(''),
  email: Joi.string().email().optional(),
  address: Joi.string().optional().allow(''),
  phone: Joi.string().optional().allow(''),
  avatar: Joi.string().optional().allow(''),
}).min(1);

// Schema cho đổi mật khẩu
const changePasswordSchema = Joi.object({
  oldPassword: Joi.string().min(8).required(),
  newPassword: Joi.string().min(8).required(),
});

// Schema cho tạo người dùng bởi admin
const createUserByAdminSchema = Joi.object({
  username: Joi.string().min(3).max(30).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  name: Joi.string().optional().allow(''),
  phone: Joi.string().optional().allow(''),
  address: Joi.string().optional().allow(''),
  role: Joi.string().valid('ADMIN', 'STAFF', 'CUSTOMER').optional(),
  avatar: Joi.string().optional().allow(''),
});

// Schema cho xóa người dùng bởi admin
const deleteUserByAdminSchema = Joi.object({
  id: Joi.string().hex().length(24).optional(),
  username: Joi.string().min(3).max(30).optional(),
}).or('id', 'username');

// Schema cho cập nhật người dùng bởi admin
const updateUserByAdminSchema = Joi.object({
  id: Joi.string().hex().length(24).optional(),
  username: Joi.string().min(3).max(30).optional(),
  password: Joi.string().min(8).optional(),
  role: Joi.string().valid('ADMIN', 'STAFF', 'CUSTOMER').optional(),
  name: Joi.string().optional().allow(''),
  email: Joi.string().email().optional(),
  phone: Joi.string().optional().allow(''),
  address: Joi.string().optional().allow(''),
  avatar: Joi.string().optional().allow(''),
}).or('id', 'username').min(1);

// Schema cho khóa/mở khóa tài khoản
const toggleUserStatusSchema = Joi.object({
  id: Joi.string().hex().length(24).required(),
});

// Schema cho lấy thông tin người dùng bởi admin
const adminGetUserInfoSchema = Joi.object({
  id: Joi.string().hex().length(24).required(),
});

// Schema cho webhook thanh toán
const paymentWebhookSchema = Joi.object({
  orderId: Joi.string().hex().length(24).required(),
  tenTaiKhoanDoiUng: Joi.string().optional().allow(''),
  soTaiKhoanDoiUng: Joi.string().optional().allow(''),
  ngayDienRa: Joi.date().iso().required(),
  giaTri: Joi.number().positive().required(),
});

// DTO cho dữ liệu người dùng
const userResponseDTO = (user) => ({
  _id: user._id,
  username: user.username,
  email: user.email,
  name: user.name,
  role: user.role,
  address: user.address,
  avatar: user.avatar,
  phone: user.phone,
  isActive: user.isActive,
  createdAt: user.createdAt ? user.createdAt.toISOString() : null,
  updatedAt: user.updatedAt ? user.updatedAt.toISOString() : null,
});

// DTO cho webhook
const paymentWebhookResponseDTO = (notification) => ({
  type: notification.type,
  orderId: notification.orderId,
  customerId: notification.customerId,
  accountName: notification.accountName,
  accountNumber: notification.accountNumber,
  transactionTime: notification.transactionTime,
  amount: notification.amount,
  message: notification.message,
  createdAt: notification.createdAt,
});

module.exports = {
  refreshTokenSchema,
  sendOTPSchema,
  searchUsersSchema,
  signUpSchema,
  loginSchema,
  updateUserSchema,
  changePasswordSchema,
  createUserByAdminSchema,
  deleteUserByAdminSchema,
  updateUserByAdminSchema,
  toggleUserStatusSchema,
  adminGetUserInfoSchema,
  paymentWebhookSchema,
  userResponseDTO,
  paymentWebhookResponseDTO,
};
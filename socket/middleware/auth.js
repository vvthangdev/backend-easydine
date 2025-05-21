/**
 * Socket.IO Authentication Middleware
 * Xác thực các kết nối socket trước khi cho phép kết nối
 */
const authUtil = require("../../utils/auth.util");

/**
 * Middleware xác thực cho Socket.IO
 * @param {Object} socket - Socket.IO socket
 * @param {Function} next - Callback function
 */
const authMiddleware = async (socket, next) => {
  try {
    // Lấy token từ handshake
    const token = socket.handshake.auth.token?.split(" ")[1];
    
    // Kiểm tra token
    if (!token) {
      return next(new Error("Access token là bắt buộc!"));
    }
    
    // Xác thực token
    const decoded = await authUtil.verifyToken(token, process.env.ACCESS_TOKEN_SECRET);
    
    // Lưu thông tin user vào socket
    socket.user = decoded.payload;
    
    next();
  } catch (error) {
    console.error("Lỗi xác thực socket:", error);
    next(new Error("Token không hợp lệ!"));
  }
};

module.exports = authMiddleware;
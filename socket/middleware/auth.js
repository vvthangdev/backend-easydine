/**
 * Socket.IO Authentication Middleware - Enhanced with logging
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
    console.log('=== Socket Auth Middleware ===');
    console.log('Socket ID:', socket.id);
    console.log('Handshake auth:', socket.handshake.auth);
    
    // Lấy token từ handshake
    const token = socket.handshake.auth.token?.split(" ")[1];
    console.log('Extracted token:', token ? 'exists' : 'missing');
    
    // Kiểm tra token
    if (!token) {
      console.log('No token provided');
      return next(new Error("Access token là bắt buộc!"));
    }
    
    // Xác thực token
    const decoded = await authUtil.verifyToken(token, process.env.ACCESS_TOKEN_SECRET);
    console.log('Token decoded successfully:', {
      userId: decoded.payload._id,
      username: decoded.payload.username,
      role: decoded.payload.role
    });
    
    // Lưu thông tin user vào socket
    socket.user = decoded.payload;
    
    console.log('Socket authentication successful for user:', socket.user.username);
    next();
  } catch (error) {
    console.error("Lỗi xác thực socket:", error);
    next(new Error("Token không hợp lệ!"));
  }
};

module.exports = authMiddleware;
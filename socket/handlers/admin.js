/**
 * Admin Socket Handlers
 * Xử lý các sự kiện socket liên quan đến admin
 */

/**
 * Thiết lập các event handlers cho admin
 * @param {Object} io - Socket.IO server instance
 * @param {Object} socket - Client socket
 * @param {Map} adminSockets - Map lưu trữ admin sockets
 */
const adminHandlers = (io, socket, adminSockets) => {
  // Chỉ đăng ký các handlers nếu người dùng là admin
  if (socket.user.role === "ADMIN") {
    
    // Handler cho sự kiện joinAdminRoom
    socket.on("joinAdminRoom", (data) => {
      socket.join(data.room);
      console.log(`Admin ${socket.user.username} joined ${data.room}`);
    });
    
    // Có thể thêm các admin handlers khác ở đây
    socket.on("adminAction", (data) => {
      console.log(`Admin ${socket.user.username} performed action:`, data);
      // Xử lý admin action
    });
  }
  
  // Handlers chung cho mọi người dùng liên quan đến admin
  socket.on("contactAdmin", (message) => {
    // Gửi tin nhắn đến tất cả admin đang online
    io.to("adminRoom").emit("userContact", {
      userId: socket.user._id,
      username: socket.user.username,
      message: message,
      timestamp: new Date().toISOString()
    });
  });
};

module.exports = adminHandlers;
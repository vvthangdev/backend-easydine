/**
 * Admin Socket Handlers - Enhanced with logging
 * Xử lý các sự kiện socket liên quan đến admin
 */

/**
 * Thiết lập các event handlers cho admin
 * @param {Object} io - Socket.IO server instance
 * @param {Object} socket - Client socket
 * @param {Map} adminSockets - Map lưu trữ admin sockets
 */
const adminHandlers = (io, socket, adminSockets) => {
  console.log('=== Setting up handlers for user ===');
  console.log('User:', socket.user.username);
  console.log('Role:', socket.user.role);
  console.log('Socket ID:', socket.id);
  
  // Chỉ đăng ký các handlers nếu người dùng là admin
  if (socket.user.role === "ADMIN") {
    console.log('Setting up ADMIN handlers...');
    
    // Handler cho sự kiện joinAdminRoom
    socket.on("joinAdminRoom", (data) => {
      console.log(`Admin ${socket.user.username} attempting to join ${data.room}`);
      socket.join(data.room);
      console.log(`Admin ${socket.user.username} successfully joined ${data.room}`);
      console.log('Current room members:', io.sockets.adapter.rooms.get(data.room)?.size || 0);
      
      // Emit confirmation back to client
      socket.emit('joinedAdminRoom', {
        room: data.room,
        message: `Successfully joined ${data.room}`,
        socketId: socket.id
      });
    });
    
    // Handler cho join thông thường (nếu có)
    socket.on("join", (room) => {
      console.log(`Admin ${socket.user.username} joining room: ${room}`);
      socket.join(room);
      console.log(`Admin ${socket.user.username} joined room: ${room}`);
    });
    
    // Có thể thêm các admin handlers khác ở đây
    socket.on("adminAction", (data) => {
      console.log(`Admin ${socket.user.username} performed action:`, data);
      // Xử lý admin action
    });
    
    // Test handler để kiểm tra kết nối
    socket.on("ping", (data) => {
      console.log(`Received ping from admin ${socket.user.username}:`, data);
      socket.emit("pong", {
        message: "Pong from server",
        timestamp: new Date().toISOString(),
        socketId: socket.id
      });
    });
  } else {
    console.log('Setting up USER handlers...');
    
    // Handler cho user join room
    socket.on("join", (room) => {
      console.log(`User ${socket.user.username} joining room: ${room}`);
      socket.join(room);
      console.log(`User ${socket.user.username} joined room: ${room}`);
      
      // Emit confirmation
      socket.emit('joinedRoom', {
        room: room,
        message: `Successfully joined ${room}`,
        socketId: socket.id
      });
    });
  }
  
  // Handlers chung cho mọi người dùng liên quan đến admin
  socket.on("contactAdmin", (message) => {
    console.log(`User ${socket.user.username} contacting admin:`, message);
    
    // Gửi tin nhắn đến tất cả admin đang online
    const notification = {
      userId: socket.user._id,
      username: socket.user.username,
      message: message,
      timestamp: new Date().toISOString()
    };
    
    console.log('Sending contact message to adminRoom:', notification);
    io.to("adminRoom").emit("userContact", notification);
  });
  
  // Handler để test kết nối
  socket.on("testConnection", () => {
    console.log(`Test connection from ${socket.user.username}`);
    socket.emit("connectionTest", {
      message: "Connection is working",
      user: socket.user.username,
      role: socket.user.role,
      socketId: socket.id,
      timestamp: new Date().toISOString()
    });
  });
};

module.exports = adminHandlers;
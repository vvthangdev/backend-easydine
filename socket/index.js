const { Server } = require("socket.io");
// const authMiddleware = require("./middleware/auth");
// const adminHandlers = require("./handlers/admin");

let io;
const adminSockets = new Map();

const init = (server, options = {}) => {
  // Khởi tạo Socket.IO server với options
    // io = new Server(server, {
  //   cors: options.cors || {
  //     origin: process.env.FRONTEND_URL || '*',
  //     methods: ["GET", "POST"],
  //   },
  // });
  io = new Server(server, {
    cors: {
      origin: `*`,
      methods: ["GET", "POST"],
    },
  });


  // Áp dụng middleware xác thực
  // io.use(authMiddleware);

  // Xử lý kết nối
  io.on("connection", (socket) => {
    console.log(
      `User ${socket.user.username} đã kết nối, socket ID: ${socket.id}`
    );

    // Xử lý các sự kiện liên quan đến admin
    if (socket.user.role === "ADMIN") {
      adminSockets.set(socket.user._id, socket);
      socket.join("adminRoom");
      console.log(
        `Admin ${socket.user.username} joined adminRoom, current adminSockets:`,
        Array.from(adminSockets.keys())
      );
    }

    // Đăng ký các event handlers
    // adminHandlers(io, socket, adminSockets);

    // Xử lý ngắt kết nối
    socket.on("disconnect", () => {
      console.log(`User ${socket.user.username} đã ngắt kết nối`);
      if (socket.user.role === "ADMIN") {
        adminSockets.delete(socket.user._id);
      }
    });
  });

  return io;
};

/**
 * Lấy instance hiện tại của Socket.IO
 * @returns {Object} Socket.IO instance
 * @throws {Error} Nếu Socket.IO chưa được khởi tạo
 */
const getIO = () => {
  if (!io) {
    throw new Error("Socket.IO chưa được khởi tạo. Hãy gọi init() trước.");
  }
  return io;
};

/**
 * Lấy danh sách admin sockets hiện tại
 * @returns {Map} Map chứa admin sockets
 */
const getAdminSockets = () => {
  return adminSockets;
};

module.exports = {
  init,
  getIO,
  getAdminSockets,
};

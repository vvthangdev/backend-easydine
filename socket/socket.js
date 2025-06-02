const { Server } = require("socket.io");
const { authMiddleware } = require("./middleware/auth.middleware");
const { registerEventHandlers } = require("./handlers/event.handler");


let io;

const socket = {
  initSocket(server) {
    io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "*", // Giới hạn origin trong production
        methods: ["GET", "POST"],
      },
    });

    console.log(`connected to : ${process.env.FRONTEND_URL}`)

    // Áp dụng middleware xác thực
    io.use(authMiddleware);

    // Xử lý sự kiện kết nối
    io.on("connection", (socket) => {
      console.log(
        `[Socket.IO] Client connected: ${socket.id}, User: ${
          socket.user?._id || "unknown"
        }`
      );
      // Đăng ký các sự kiện cho socket
      registerEventHandlers(socket, io);
    });

    return io;
  },

  getIO() {
    if (!io) {
      console.error("[Socket.IO] Socket.IO not initialized!");
      throw new Error("Socket.IO chưa khởi tạo!");
    }
    return io;
  },
};

module.exports = socket;
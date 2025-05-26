const { Server } = require("socket.io");
const authUtil = require("./utils/auth.util"); // Import hàm verifyToken

let io;

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "*", // Giới hạn origin trong production
      methods: ["GET", "POST"],
    },
  });

  // Middleware xác thực token
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    console.log("[Socket.IO Middleware] Received token:", token); // Log token nhận được
    if (!token) {
      console.log("[Socket.IO Middleware] No token provided");
      return next(new Error("Access token is required"));
    }

    try {
      const decoded = await authUtil.verifyToken(
        token,
        process.env.ACCESS_TOKEN_SECRET
      );
      console.log("[Socket.IO Middleware] Decoded token:", decoded); // Log payload của token
      if (!decoded) {
        console.log(
          "[Socket.IO Middleware] Token verification failed: null decoded"
        );
        return next(new Error("Invalid token"));
      }
      socket.user = decoded.payload; // Lưu payload của token vào socket.user
      console.log("[Socket.IO Middleware] Token verified, user:", socket.user);
      next();
    } catch (error) {
      console.error(
        "[Socket.IO Middleware] Token verification error:",
        error.message
      ); // Log lỗi cụ thể
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    console.log(
      `[Socket.IO] Client connected: ${socket.id}, User: ${
        socket.user?._id || "unknown"
      }`
    );

    socket.on("sendDataClient", (data) => {
      console.log(
        `[Socket.IO] Received sendDataClient from ${socket.id}:`,
        data
      );
      console.log(`[Socket.IO] Broadcasting sendDataServer to all clients`);
      io.emit("sendDataServer", { data });
    });

    socket.on("admin", (data) => {
      console.log(`[Socket.IO] Received admin from ${socket.id}:`, data);
      if (socket.user.role === "admin") {
        console.log(
          `[Socket.IO] User ${socket.user._id} is admin, joining adminRoom`
        );
        socket.join("adminRoom");
        console.log(`[Socket.IO] Emitting admin event to adminRoom`);
        io.to("adminRoom").emit("admin", data);
      } else {
        console.log(
          `[Socket.IO] Unauthorized admin attempt by ${socket.user._id}`
        );
        socket.emit("error", {
          message: "Unauthorized: Admin access required",
        });
      }
    });

    socket.on("admintest", (data) => {
      console.log(`[Socket.IO] Received admintest from ${socket.id}:`, data);
      if (socket.user.role === "admin") {
        console.log(
          `[Socket.IO] User ${socket.user._id} is admin, joining adminRoom`
        );
        socket.join("adminRoom");
        console.log(`[Socket.IO] Emitting admintest event to adminRoom`);
        io.to("adminRoom").emit("admintest", data);
      } else {
        console.log(
          `[Socket.IO] Unauthorized admintest attempt by ${socket.user._id}`
        );
        socket.emit("error", {
          message: "Unauthorized: Admin access required",
        });
      }
    });

    socket.on("newOrder", (data) => {
      console.log(`[Socket.IO] Received newOrder from ${socket.id}:`, data);
      console.log(`[Socket.IO] Emitting newOrder event to adminRoom`);
      io.to("adminRoom").emit("newOrder", data);
    });

    socket.onAny((event, ...args) => {
      console.log(
        `[Socket.IO] Received event from ${socket.id}: ${
          event || "unnamed"
        }, Payload:`,
        args
      );
    });

    socket.on("disconnect", () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });
}

function getIO() {
  if (!io) {
    console.error("[Socket.IO] Socket.IO not initialized!");
    throw new Error("Socket.IO chưa khởi tạo!");
  }
  return io;
}

module.exports = { initSocket, getIO };

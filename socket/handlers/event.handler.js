function registerEventHandlers(socket, io) {
  // Tự động thêm admin vào adminRoom khi kết nối
  if (socket.user.role === "ADMIN" || socket.user.role === "STAFF") {
    console.log(`[Socket.IO] User ${socket.user._id} is admin, joining adminRoom`);
    socket.join("adminRoom");
  }

  // Xử lý sự kiện sendDataClient
  socket.on("sendDataClient", (data) => {
    console.log(`[Socket.IO] Received sendDataClient from ${socket.id}:`, data);
    console.log(`[Socket.IO] Broadcasting sendDataServer to all clients`);
    io.emit("sendDataServer", { data });
  });

  // Xử lý sự kiện admin
  socket.on("admin", (data) => {
    console.log(`[Socket.IO] Received admin from ${socket.id}:`, data);
    if (socket.user.role === "admin") {
      console.log(`[Socket.IO] User ${socket.user._id} is admin, joining adminRoom`);
      socket.join("adminRoom");
      console.log(`[Socket.IO] Emitting admin event to adminRoom`);
      io.to("adminRoom").emit("admin", data);
    } else {
      console.log(`[Socket.IO] Unauthorized admin attempt by ${socket.user._id}`);
      socket.emit("error", {
        message: "Unauthorized: Admin access required",
      });
    }
  });

  // Xử lý sự kiện admintest
  socket.on("admintest", (data) => {
    console.log(`[Socket.IO] Received admintest from ${socket.id}:`, data);
    if (socket.user.role === "admin") {
      console.log(`[Socket.IO] User ${socket.user._id} is admin, joining adminRoom`);
      socket.join("adminRoom");
      console.log(`[Socket.IO] Emitting admintest event to adminRoom`);
      io.to("adminRoom").emit("admintest", data);
    } else {
      console.log(`[Socket.IO] Unauthorized admintest attempt by ${socket.user._id}`);
      socket.emit("error", {
        message: "Unauthorized: Admin access required",
      });
    }
  });

  // Xử lý sự kiện newOrder
  socket.on("newOrder", (data) => {
    console.log(`[Socket.IO] Received newOrder from ${socket.id}:`, data);
    console.log(`[Socket.IO] Emitting newOrder event to adminRoom`);
    io.to("adminRoom").emit("newOrder", data);
  });

  // Xử lý mọi sự kiện (onAny)
  socket.onAny((event, ...args) => {
    console.log(
      `[Socket.IO] Received event from ${socket.id}: ${event || "unnamed"}, Payload:`,
      args
    );
  });

  // Xử lý sự kiện disconnect
  socket.on("disconnect", () => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
  });
}

module.exports = { registerEventHandlers };
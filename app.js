const express = require("express");
const cors = require("cors");
const app = express();
const { Server } = require("socket.io");
const { createServer } = require("node:http");
const server = createServer(app);
const io = new Server(server);
// const Message = require("./models/message.js");
// const conversationService = require("./services/conversation.service.js");
require("dotenv").config();
const os = require("os");

const connectDB = require("./config/db.config.js"); // Thay Sequelize bằng MongoDB
const userRoutes = require("./routes/user.routes");
// const conversationRoutes = require("./routes/conversation.routes");
const tableRouter = require("./routes/table.routes.js");
const orderRouter = require("./routes/order.routes.js");
const itemRouter = require("./routes/item.routes.js");
const itemOrdRouter = require("./routes/item_order.routes.js");
// const itemCategoryRouter = require("./routes/item_category.routes.js");
const adminRouter = require("./routes/admin.routes.js");
// const contactRouter = require("./routes/contact.routes.js");

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/auth", userRoutes);
// app.use("/api/conversation", conversationRoutes);
app.use("/tables", tableRouter);
app.use("/orders", orderRouter);
app.use("/item", itemRouter);
app.use("/item-order", itemOrdRouter);
// app.use("/admin", adminRouter);
// app.use("/contact", contactRouter);

// Socket.io logic (giữ nguyên)
// let users = {};
// io.on("connection", (socket) => {
//   socket.on("join", (userData) => {
//     users[socket.id] = userData;
//   });
//   socket.on("send_message", async (messageData) => {
//     const { sender_id, receiver_id, conversation_id, message } = messageData;
//     const recipientSocketId = Object.keys(users).find(
//       (id) => users[id].id === receiver_id
//     );
//     if (recipientSocketId) {
//       io.to(recipientSocketId).emit("receive_message", {
//         from: sender_id,
//         message: message,
//       });
//     } else {
//       console.log("Recipient not found");
//     }
//     await Message.create({
//       sender_id: sender_id,
//       conversation_id: conversation_id,
//       content: message,
//     });
//   });
//   socket.on("disconnect", () => {
//     // Sửa "disconect" thành "disconnect"
//     console.log("User disconnected", socket.id);
//     delete users[socket.id];
//   });
// });

const PORT = process.env.PORT || 8080;

// function getLocalIp() {
//   const interfaces = os.networkInterfaces();
//   for (let iface of Object.values(interfaces)) {
//     for (let details of iface) {
//       if (details.family === "IPv4" && !details.internal) {
//         return details.address;
//       }
//     }
//   }
//   return "localhost";
// }

connectDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}/`);
    });
  })
  .catch((err) => {
    console.error("Unable to connect to the database:", err);
  });

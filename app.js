const express = require("express");
const cors = require("cors");
const path = require("path");
const { createServer } = require("node:http");
const multer = require("multer");
const session = require("express-session");
const passport = require("passport");
// const socketModule = require("./socket/index.js");
const socket = require("./socket.js");

// Khởi tạo Express app và HTTP server
const app = express();
const server = createServer(app);
const upload = multer();

// Cấu hình middleware cơ bản
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Tải biến môi trường
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

app.use(
  cors({
    origin: process.env.FRONTEND_URL || true,
    credentials: true,
  })
);

socket.initSocket(server)
// Cấu hình CORS
const corsOptions = {
  origin: process.env.FRONTEND_URL,
  methods: ["GET", "POST"],
};

// Khởi tạo Socket.IO
// socketModule.init(server, { cors: corsOptions });

// Cấu hình session
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === "production" },
  })
);

// Cấu hình Passport
app.use(passport.initialize());
app.use(passport.session());
require("./config/passport")(passport);

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

// Routes cơ bản
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// API thông tin về admin sockets
// app.get("/api/admin-sockets", (req, res) => {
//   const adminSockets = socketModule.getAdminSockets();
//   const connectedAdmins = Array.from(adminSockets.keys());

//   res.json({
//     status: "SUCCESS",
//     message: "List of connected admin sockets",
//     data: {
//       count: connectedAdmins.length,
//       adminIds: connectedAdmins,
//     },
//   });
// });

// API test thông báo đơn hàng mới
// app.post("/api/test-new-order", (req, res) => {
//   try {
//     const io = socketModule.getIO();
//     const notification = {
//       orderId: "test123",
//       customerId: "test789",
//       type: "reservation",
//       status: "pending",
//       staffId: null,
//       time: new Date().toISOString(),
//       createdAt: new Date().toISOString(),
//       message: "Test new order notification",
//     };

//     console.log("Sending newOrder notification to adminRoom:", notification);
//     console.log("Current adminRoom sockets:", io.sockets.adapter.rooms.get('adminRoom')?.size || 0);
//     io.to('adminRoom').emit("newOrder", notification);

//     res.json({
//       status: "SUCCESS",
//       message: "Test newOrder notification sent",
//       data: notification,
//     });
//   } catch (error) {
//     res.status(500).json({
//       status: "ERROR",
//       message: error.message
//     });
//   }
// });

// Import routes
const connectDB = require("./config/db.config.js");
const userRoutes = require("./routes/user.routes.js");
const tableRouter = require("./routes/table.routes.js");
const orderRouter = require("./routes/order.routes.js");
const itemRouter = require("./routes/item.routes.js");
const itemOrdRouter = require("./routes/item_order.routes.js");
const adminRouter = require("./routes/admin.routes.js");
const voucherRouter = require("./routes/voucher.routes.js");

// Đăng ký routes
app.use("/item", upload.none(), itemRouter);
app.use("/users", userRoutes);
app.use("/tables", tableRouter);
app.use("/orders", orderRouter);
app.use("/item-order", itemOrdRouter);
app.use("/admin", adminRouter);
app.use("/vouchers", voucherRouter);

// Khởi động server
const PORT = process.env.PORT || 8080;

connectDB()
  .then(() => {
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Server is running on http://0.0.0.0:${PORT}/`);
    });
  })
  .catch((err) => {
    console.error("Unable to connect to the database:", err);
  });

module.exports = { app, server };

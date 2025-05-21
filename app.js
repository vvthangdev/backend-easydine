const express = require("express");
const cors = require("cors");
const app = express();
const path = require("path");
const { Server } = require("socket.io");
const { createServer } = require("node:http");
const server = createServer(app);
const jwt = require("jsonwebtoken");
const User = require("./models/user.model.js");
const authUtil = require("./utils/auth.util.js")

const multer = require("multer");
const session = require("express-session");
const passport = require("passport");
const upload = multer();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST"],
  },
});

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token?.split(' ')[1];
    if (!token) {
      return next(new Error('Access token là bắt buộc!'));
    }

    const decoded = await authUtil.verifyToken(token, process.env.ACCESS_TOKEN_SECRET);
    socket.user = decoded.payload;
    next();
  } catch (error) {
    console.error('Lỗi xác thực socket:', error);
    next(new Error('Token không hợp lệ!'));
  }
});

const adminSockets = new Map();

io.on('connection', (socket) => {
  console.log(`User ${socket.user.username} đã kết nối, socket ID: ${socket.id}`);

  if (socket.user.role === 'ADMIN') {
    adminSockets.set(socket.user._id, socket);
    socket.join('adminRoom');
    console.log(`Admin ${socket.user.username} joined adminRoom, current adminSockets:`, Array.from(adminSockets.keys()));
  }

  socket.on('joinAdminRoom', (data) => {
    if (socket.user.role === 'ADMIN') {
      socket.join(data.room);
      console.log(`User ${socket.user.username} joined ${data.room}`);
    }
  });

  socket.on('disconnect', () => {
    console.log(`User ${socket.user.username} đã ngắt kết nối`);
    if (socket.user.role === 'ADMIN') {
      adminSockets.delete(socket.user._id);
    }
  });
});

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === "production" },
  })
);

app.use(passport.initialize());
app.use(passport.session());

require("./config/passport")(passport);

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/api/admin-sockets", (req, res) => {
  const connectedAdmins = Array.from(adminSockets.keys());
  res.json({
    status: "SUCCESS",
    message: "List of connected admin sockets",
    data: {
      count: connectedAdmins.length,
      adminIds: connectedAdmins,
    },
  });
});

app.post("/api/test-new-order", (req, res) => {
  const notification = {
    orderId: "test123",
    customerId: "test789",
    type: "reservation",
    status: "pending",
    staffId: null,
    time: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    message: "Test new order notification",
  };

  // console.log("Sending newOrder notification to adminRoom:", notification);
  // console.log("Current adminRoom sockets:", io.sockets.adapter.rooms.get('adminRoom')?.size || 0);
  io.to('adminRoom').emit("newOrder", notification);

  res.json({
    status: "SUCCESS",
    message: "Test newOrder notification sent",
    data: notification,
  });
});

const connectDB = require("./config/db.config.js");
const userRoutes = require("./routes/user.routes.js");
const tableRouter = require("./routes/table.routes.js");
const orderRouter = require("./routes/order.routes.js");
const itemRouter = require("./routes/item.routes.js");
const itemOrdRouter = require("./routes/item_order.routes.js");
const adminRouter = require("./routes/admin.routes.js");
const voucherRouter = require("./routes/voucher.routes.js");

app.use("/item", upload.none(), itemRouter);
app.use("/users", userRoutes);
app.use("/tables", tableRouter);
app.use("/orders", orderRouter);
app.use("/item-order", itemOrdRouter);
app.use("/admin", adminRouter);
app.use("/vouchers", voucherRouter);

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

module.exports = { app, server, io, adminSockets };
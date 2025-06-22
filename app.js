const express = require("express");
const cors = require("cors");
const path = require("path");
const { createServer } = require("node:http");
const multer = require("multer");
const session = require("express-session");
const passport = require("passport");
// const socketModule = require("./socket/index.js");
const socket = require ("./socket/socket.js")
const admin = require("firebase-admin");





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
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);


// app.use(
//   cors({
//     origin: process.env.FRONTEND_URL || true,
//     credentials: true,
//   })
// );

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

socket.initSocket(server)

// Cấu hình session
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === "production" },
  })
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

app.use(passport.initialize());
app.use(passport.session());
require("./config/passport")(passport);

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

// Routes cơ bản
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Import routes
const connectDB = require("./config/db.config.js");
const userRoutes = require("./routes/user.routes.js");
const tableRouter = require("./routes/table.routes.js");
const orderRouter = require("./routes/order.routes.js");
const itemRouter = require("./routes/item.routes.js");
const itemOrdRouter = require("./routes/item_order.routes.js");
const adminRouter = require("./routes/admin.routes.js");
const voucherRouter = require("./routes/voucher.routes.js");
const canceledItemOrderRouter = require("./routes/canceledItem.routes.js")
const analyticsRouter = require("./routes/analytics.route.js")

// Đăng ký routes
app.use("/item", itemRouter);
app.use("/users", userRoutes);
app.use("/tables", tableRouter);
app.use("/orders", orderRouter);
app.use("/item-order", itemOrdRouter);
app.use("/admin", adminRouter);
app.use("/vouchers", voucherRouter);
app.use("/canceled-item-orders", canceledItemOrderRouter)
app.use("/analytics", analyticsRouter)

require('./utils/scheduler.js');

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

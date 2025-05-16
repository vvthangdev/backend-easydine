const express = require("express");
const cors = require("cors");
const app = express();
const path = require("path");
const { Server } = require("socket.io");
const { createServer } = require("node:http");
const server = createServer(app);
const io = new Server(server);
const multer = require("multer");
const session = require("express-session");
const passport = require("passport");
const upload = multer();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
//v2
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

// Cấu hình session
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === "production" }, // Secure trong production
  })
);

// Khởi tạo Passport
app.use(passport.initialize());
app.use(passport.session());

// Load Google Strategy
require("./config/passport")(passport);

// Cung cấp file tĩnh
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Cấu hình CORS
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

// Routes
const connectDB = require("./config/db.config.js");
const userRoutes = require("./routes/user.routes");
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

// Khởi động server
const PORT = process.env.PORT || 8080;

function kiemTraBienMoiTruong() {
  const bienBatBuoc = [
    "PORT",
    "MONGO_URI",
    "ACCESS_TOKEN_SECRET",
    "ACCESS_TOKEN_LIFE",
    "REFRESH_TOKEN_SECRET",
    "REFRESH_TOKEN_LIFE",
    "REFRESH_TOKEN_SIZE",
    "END_TIME_OFFSET_MINUTES",
    "EMAIL_USER",
    "EMAIL_PASS",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_CALLBACK_URL",
    "SESSION_SECRET",
    "FRONTEND_URL",
    "VT_ENV",
  ];

  console.log("=== KIỂM TRA BIẾN MÔI TRƯỜNG ===");
  for (const tenBien of bienBatBuoc) {
    if (process.env[tenBien]) {
      const giaTriHienThi =
        process.env[tenBien].length > 5
          ? process.env[tenBien].substring(0, 3) + "..."
          : "[có giá trị]";
      console.log(`✅ ${tenBien}: ${giaTriHienThi}`);
    } else {
      console.log(`❌ ${tenBien}: THIẾU`);
    }
  }
  console.log("================================");
}

// Gọi hàm kiểm tra
kiemTraBienMoiTruong();

connectDB()
  .then(() => {
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Server is running on http://0.0.0.0:${PORT}/`);
    });
  })
  .catch((err) => {
    console.error("Unable to connect to the database:", err);
  });

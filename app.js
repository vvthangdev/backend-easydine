const express = require("express");
const cors = require("cors");
const app = express();
const path = require("path");
const { Server } = require("socket.io");
const { createServer } = require("node:http");
const server = createServer(app);
const io = new Server(server);
const multer = require("multer");
const fs = require("fs");

// Cấu hình multer để xử lý form-data (không lưu file)
const upload = multer();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Hàm đọc secret từ file
const readSecret = (secretName) => {
  try {
    const secretPath = `/run/secrets/${secretName}`;
    if (fs.existsSync(secretPath)) {
      return fs.readFileSync(secretPath, "utf8").trim();
    }
  } catch (err) {
    console.error(`Error reading secret ${secretName}:`, err);
  }
  return null;
};

// Tải biến môi trường từ .env (cho môi trường phát triển)
require("dotenv").config();

// Danh sách các secrets (in hoa, đồng bộ với .env)
const secrets = [
  "MONGO_URI",
  "ACCESS_TOKEN_SECRET",
  "ACCESS_TOKEN_LIFE",
  "REFRESH_TOKEN_SECRET",
  "REFRESH_TOKEN_LIFE",
  "REFRESH_TOKEN_SIZE",
  "END_TIME_OFFSET_MINUTES",
  "EMAIL_USER",
  "EMAIL_PASS",
];

// Ghi đè biến môi trường bằng giá trị từ secrets nếu tồn tại
secrets.forEach((secret) => {
  const secretValue = readSecret(secret);
  if (secretValue) {
    process.env[secret] = secretValue;
  }
});

app.use(express.static(path.join(__dirname, "public")));

// Route để trả về index.html khi truy cập /
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const connectDB = require("./config/db.config.js");
const userRoutes = require("./routes/user.routes");
const tableRouter = require("./routes/table.routes.js");
const orderRouter = require("./routes/order.routes.js");
const itemRouter = require("./routes/item.routes.js");
const itemOrdRouter = require("./routes/item_order.routes.js");
const adminRouter = require("./routes/admin.routes.js");
const voucherRouter = require("./routes/voucher.routes.js");

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Thêm middleware multer cho các route cần xử lý form-data
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
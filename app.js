const express = require("express");
const cors = require("cors");
const app = express();
const { Server } = require("socket.io");
const { createServer } = require("node:http");
const server = createServer(app);
const io = new Server(server);
const multer = require("multer"); // Đã có sẵn

// Cấu hình multer để xử lý form-data (không lưu file vì không có file upload)
const upload = multer(); // Không cần storage vì không có file
app.use(express.urlencoded({ extended: true })); // Đảm bảo xử lý URL-encoded data
app.use(express.json()); // Xử lý JSON nếu cần

require("dotenv").config();
const os = require("os");

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
// Áp dụng cho tất cả các route trong itemRouter
app.use("/item", upload.none(), itemRouter); // upload.none() để chỉ xử lý text fields

app.use("/users", userRoutes);
app.use("/tables", tableRouter);
app.use("/orders", orderRouter);
app.use("/item-order", itemOrdRouter);
app.use("/admin", adminRouter);
app.use("/vouchers", voucherRouter);

const PORT = process.env.PORT || 8080;

// connectDB()
//   .then(() => {
//     server.listen(PORT, () => {
//       console.log(`Server is running on http://localhost:${PORT}/`);
//     });
//   })
//   .catch((err) => {
//     console.error("Unable to connect to the database:", err);
//   });
connectDB()
  .then(() => {
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Server is running on http://0.0.0.0:${PORT}/`);
    });
  })
  .catch((err) => {
    console.error("Unable to connect to the database:", err);
  });

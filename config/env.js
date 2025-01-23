// Load thư viện dotenv để đọc file .env
const dotenv = require("dotenv");

// Load các biến môi trường từ file .env
dotenv.config();

// Xuất ra các biến môi trường để sử dụng trong các phần khác của ứng dụng
module.exports = {
  dbHost: process.env.DB_HOST,
  dbUser: process.env.DB_USER,
  dbPassword: process.env.DB_PASSWORD,
  dbName: process.env.DB_NAME,
  port: process.env.PORT || 3000,
};

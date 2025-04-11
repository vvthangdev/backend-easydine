require("dotenv").config(); // Load biến môi trường từ .env
console.log("MONGO_URI:", process.env.MONGO_URI); // Debug để kiểm tra

const mongoose = require("mongoose");
const User = require("../be-EasyDine/models/user.model"); // Điều chỉnh đường dẫn nếu cần

// Hàm loại bỏ dấu tiếng Việt và chuyển thành chữ thường
function removeVietnameseAccents(str) {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

async function fixUserFields() {
  try {
    // Kết nối tới MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB successfully");

    // Tìm tất cả user
    const users = await User.find();
    console.log(`Found ${users.length} users`);

    // Cập nhật từng user
    for (let user of users) {
      let needsUpdate = false;
      const updates = {};

      // Kiểm tra và sửa các trường nếu là null
      if (user.name === null) {
        updates.name = "";
        needsUpdate = true;
      }
      if (user.nameNoAccents === null || (user.name && !user.nameNoAccents)) {
        updates.nameNoAccents = user.name ? removeVietnameseAccents(user.name) : "";
        needsUpdate = true;
      }
      if (user.address === null) {
        updates.address = "";
        needsUpdate = true;
      }
      if (user.avatar === null) {
        updates.avatar = "";
        needsUpdate = true;
      }
      if (user.phone === null) {
        updates.phone = "";
        needsUpdate = true;
      }
      if (user.refresh_token === undefined) {
        updates.refresh_token = null;
        needsUpdate = true;
      }

      // Nếu có thay đổi, cập nhật user
      if (needsUpdate) {
        await User.updateOne({ _id: user._id }, { $set: updates });
        console.log(`Updated user ${user.username}:`, updates);
      }
    }

    console.log("Finished fixing user fields");
  } catch (error) {
    console.error("Error fixing user fields:", error);
  } finally {
    // Ngắt kết nối
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

// Chạy hàm
fixUserFields();
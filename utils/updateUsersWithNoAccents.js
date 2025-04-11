require("dotenv").config(); // Load .env
console.log("MONGO_URI:", process.env.MONGO_URI); // Debug để kiểm tra

const mongoose = require("mongoose");
const connectDB = require("../config/db.config.js"); // Điều chỉnh đường dẫn nếu cần
const User = require("../models/user.model.js");

function removeVietnameseAccents(str) {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

async function updateUsersWithNoAccents() {
  try {
    await connectDB();
    console.log("Connected to MongoDB successfully");

    const users = await User.find();
    console.log(`Found ${users.length} users`);

    for (let user of users) {
      if (user.name) {
        user.nameNoAccents = removeVietnameseAccents(user.name);
        await user.save();
        console.log(`Updated user: ${user.name} -> ${user.nameNoAccents}`);
      }
    }
    console.log("Updated all users with nameNoAccents");
  } catch (error) {
    console.error("Error updating users:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

updateUsersWithNoAccents();
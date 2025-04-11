require('dotenv').config(); // Load .env
console.log("MONGO_URI:", process.env.MONGO_URI); // Debug để kiểm tra

const mongoose = require('mongoose');
const connectDB = require("../config/db.config.js"); // Kiểm tra đường dẫn
const Item = require("../models/item.model.js");

function removeVietnameseAccents(str) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

async function updateItemsWithNoAccents() {
  try {
    await connectDB();
    console.log("Connected to MongoDB successfully");

    const items = await Item.find();
    console.log(`Found ${items.length} items`);

    for (let item of items) {
      item.nameNoAccents = removeVietnameseAccents(item.name);
      await item.save();
      console.log(`Updated item: ${item.name}`);
    }
    console.log("Updated all items with nameNoAccents");
  } catch (error) {
    console.error("Error updating items:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

updateItemsWithNoAccents();
const mongoose = require("mongoose");

const guestSchema = new mongoose.Schema({
  name: { type: String, maxLength: 100, default: null }, 
  phone: { type: String, maxLength: 20, default: null }, 
  email: { type: String, maxLength: 100, default: null }, 
  // rating_pin: { type: String, required: true }, 
  created_at: { type: Date, default: Date.now },
  expires_at: { type: Date },
}, { timestamps: false });

module.exports = mongoose.model("Guest", guestSchema);
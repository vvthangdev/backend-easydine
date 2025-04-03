const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String },
  role: { type: String, default: 'user' },
  address: { type: String },
  avatar: { type: String },
  phone: { type: String },
  refresh_token: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
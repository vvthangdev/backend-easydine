const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, maxLength: 100 },
  description: { type: String, maxLength: 255 },
  image: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Category', categorySchema);
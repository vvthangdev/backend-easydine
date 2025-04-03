const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  name: { type: String, required: true, maxLength: 255 },
  image: { type: String, required: true, maxLength: 255 },
  price: { type: Number }
}, { timestamps: false });

module.exports = mongoose.model('Item', itemSchema);
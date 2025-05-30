const mongoose = require('mongoose');

const itemOrderSchema = new mongoose.Schema({
  item_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  quantity: { type: Number, required: true },
  order_id: { type: mongoose.Schema.Types.ObjectId, ref: 'OrderDetail', required: true },
  size: { type: String },
  note: { type: String, default: "" }
}, { timestamps: false });

module.exports = mongoose.model('ItemOrder', itemOrderSchema);
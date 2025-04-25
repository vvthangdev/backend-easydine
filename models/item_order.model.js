const mongoose = require('mongoose');

const itemOrderSchema = new mongoose.Schema({
  item_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  quantity: { type: Number, required: true },
  order_id: { type: mongoose.Schema.Types.ObjectId, ref: 'OrderDetail', required: true },
  size: { type: String }, // Tên size được chọn (ví dụ: "Small"), null nếu không có
  note: { type: String, default: "" } // Ghi chú cho món ăn
}, { timestamps: false });

module.exports = mongoose.model('ItemOrder', itemOrderSchema);
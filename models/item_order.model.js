const mongoose = require('mongoose');

const itemOrderSchema = new mongoose.Schema({
  item_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  quantity: { type: Number },
  order_id: { type: mongoose.Schema.Types.ObjectId, ref: 'OrderDetail', required: true }
}, { timestamps: false });

module.exports = mongoose.model('ItemOrder', itemOrderSchema);
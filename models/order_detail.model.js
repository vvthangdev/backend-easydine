const mongoose = require('mongoose');

const orderDetailSchema = new mongoose.Schema({
  customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  staff_id: {type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null},
  time: { type: Date, default: Date.now }, // Thời gian đặt hàng
  type: { type: String, enum: ['reservation', 'ship'], required: true },
  status: { 
    type: String, 
    enum: ['pending', 'confirmed', 'canceled', 'completed'], 
    default: 'pending' 
  },
  star: { type: Number },
  comment: { type: String, maxLength: 255 }
}, { timestamps: false });

module.exports = mongoose.model('OrderDetail', orderDetailSchema);
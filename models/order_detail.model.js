// models/orderDetail.model.js
const mongoose = require('mongoose');

const orderDetailSchema = new mongoose.Schema({
  customer_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  staff_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  time: { type: Date, default: Date.now },
  type: { type: String, enum: ["reservation", "ship"], required: true },
  status: {
    type: String,
    enum: ["pending", "confirmed", "canceled", "completed"],
    default: "pending",
  },
  star: { type: Number },
  comment: { type: String, maxLength: 255 },
  transaction_id: { type: String, default: null },
  payment_status: {
    type: String,
    enum: ["pending", "success", "failed"],
    default: "pending",
  },
  voucher_id: { type: mongoose.Schema.Types.ObjectId, ref: "Voucher", default: null }, // Thêm trường này
}, { timestamps: false });

module.exports = mongoose.model("OrderDetail", orderDetailSchema);
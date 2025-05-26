const mongoose = require('mongoose');

const orderDetailSchema = new mongoose.Schema({
  customer_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  staff_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  time: { type: Date, default: Date.now },
  type: { type: String, enum: ["reservation", "takeaway"], required: true },
  status: {
    type: String,
    enum: ["pending", "confirmed", "canceled", "completed"],
    default: "pending",
  },
  star: { type: Number },
  comment: { type: String, maxLength: 255 },
  transaction_id: { type: String, default: null }, // vnp_TxnRef
  vnp_transaction_no: { type: String, default: null }, // vnp_TransactionNo từ VNPay
  payment_method: { 
    type: String, 
    enum: ["vnpay", "cash", "bank_transfer"], 
    default: "vnpay" 
  },
  payment_status: {
    type: String,
    enum: ["pending", "success", "failed"],
    default: "pending",
  },
  voucher_id: { type: mongoose.Schema.Types.ObjectId, ref: "Voucher", default: null },
  total_amount: { type: Number, default: 0 },
  discount_amount: { type: Number, default: 0 },
  final_amount: { type: Number, default: 0 },
}, { timestamps: false });

module.exports = mongoose.model("OrderDetail", orderDetailSchema);
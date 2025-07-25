const mongoose = require("mongoose");

const orderDetailSchema = new mongoose.Schema(
  {
    customer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    guest_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Guest",
      default: null,
    },
    staff_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    cashier_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    time: { type: Date, default: Date.now },
    number_people: { type: Number, default: 1 },
    type: { type: String, enum: ["reservation", "takeaway"], required: true },
    status: {
      type: String,
      enum: ["pending", "confirmed", "canceled", "completed"],
      default: "pending",
    },
    star: { type: Number, default: null },
    comment: { type: String, maxLength: 255, default: null },
    transaction_id: { type: String, default: null }, // vnp_TxnRef
    vnp_transaction_no: { type: String, default: null }, // vnp_TransactionNo từ VNPay
    payment_method: {
      type: String,
      enum: ["vnpay", "cash", "bank_transfer"],
    },
    payment_status: {
      type: String,
      enum: ["pending", "success", "failed"],
      default: "pending",
    },
    voucher_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Voucher",
      default: null,
    },
    total_amount: { type: Number, default: 0 },
    discount_amount: { type: Number, default: 0 },
    final_amount: { type: Number, default: 0 },
    rating_pin: { type: String, default: null },
  },
  { timestamps: false }
);

orderDetailSchema.index({ rating_pin: 1 });

module.exports = mongoose.model("OrderDetail", orderDetailSchema);

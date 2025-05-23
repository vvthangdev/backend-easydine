const mongoose = require("mongoose");

const canceledItemOrderSchema = new mongoose.Schema({
  item_id: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
  quantity: { type: Number, required: true },
  order_id: { type: mongoose.Schema.Types.ObjectId, ref: "OrderDetail", required: true },
  size: { type: String }, // Kích cỡ (tùy chọn)
  note: { type: String, default: "" }, // Ghi chú từ đơn hàng gốc
  cancel_reason: { type: String, required: true }, // Lý do hủy
  canceled_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Người hủy
  canceled_at: { type: Date, default: Date.now }, // Thời gian hủy
});

module.exports = mongoose.model("CanceledItemOrder", canceledItemOrderSchema);
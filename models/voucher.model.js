const mongoose = require("mongoose");

const voucherSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    discount: { type: Number, required: true, min: 0 },
    discountType: {
      type: String,
      enum: ["percentage", "fixed"],
      required: true,
    },
    minOrderValue: { type: Number, default: 0, min: 0 },
    applicableUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    usageLimit: { type: Number, default: null, min: 0 },
    usedCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Voucher", voucherSchema);

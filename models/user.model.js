const mongoose = require("mongoose");

function removeVietnameseAccents(str) {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String, default: "" },
    nameNoAccents: { type: String, default: "" },
    role: {
      type: String,
      enum: ["ADMIN", "STAFF", "CUSTOMER"],
      default: "CUSTOMER",
    },
    address: { type: String, default: "" },
    avatar: { type: String, default: "" },
    phone: { type: String, default: "" },
    refresh_token: { type: String, default: null },
    googleId: { type: String, unique: true, sparse: true },
    isActive: { type: Boolean, default: true }, // Thêm trường isActive
  },
  { timestamps: true }
);

userSchema.pre("save", function (next) {
  if (this.name) {
    this.nameNoAccents = removeVietnameseAccents(this.name);
  }
  next();
});

userSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate();
  if (update.name) {
    update.nameNoAccents = removeVietnameseAccents(update.name);
  }
  next();
});

module.exports = mongoose.model("User", userSchema);
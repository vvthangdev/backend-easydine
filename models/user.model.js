const mongoose = require("mongoose");

// Hàm loại bỏ dấu tiếng Việt và chuyển thành chữ thường
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
    nameNoAccents: { type: String, default: "" }, // Giá trị mặc định
    role: {
      type: String,
      enum: ["ADMIN", "STAFF", "CUSTOMER"],
      default: "CUSTOMER",
    },
    address: { type: String, default: "" },
    avatar: { type: String, default: "" },
    phone: { type: String, default: "" }, // Giá trị mặc định
    refresh_token: { type: String, default: null },
  },
  { timestamps: true }
);

// Middleware để tự động sinh nameNoAccents trước khi lưu
userSchema.pre("save", function (next) {
  if (this.name) {
    this.nameNoAccents = removeVietnameseAccents(this.name);
  }
  next();
});

// Middleware để tự động cập nhật nameNoAccents khi update
userSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate();
  if (update.name) {
    update.nameNoAccents = removeVietnameseAccents(update.name);
  }
  next();
});

module.exports = mongoose.model("User", userSchema);
const mongoose = require('mongoose');

// Hàm loại bỏ dấu tiếng Việt
function removeVietnameseAccents(str) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

const itemSchema = new mongoose.Schema({
  name: { type: String, required: true, maxLength: 255 },
  nameNoAccents: { type: String, maxLength: 255 },
  price: { type: Number, required: true },
  description: { type: String, maxLength: 1000 }, // Tùy chọn
  image: { type: String, maxLength: 255 }, // Tùy chọn
  categories: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Category' 
  }], // Tùy chọn
  sizes: [{ 
    name: { type: String, required: true }, 
    price: { type: Number, required: true } 
  }], // Tùy chọn
}, { timestamps: false });

// Middleware để tự động sinh nameNoAccents trước khi lưu
itemSchema.pre('save', function (next) {
  if (this.name) {
    this.nameNoAccents = removeVietnameseAccents(this.name);
  }
  next();
});

// Middleware để tự động cập nhật nameNoAccents khi update
itemSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate();
  if (update.name) {
    update.nameNoAccents = removeVietnameseAccents(update.name);
  }
  next();
});

module.exports = mongoose.model('Item', itemSchema);
const mongoose = require('mongoose');

const tableInfoSchema = new mongoose.Schema({
  table_number: { type: Number, required: true },
  capacity: { type: Number, required: true },
  area: { type: String, default: 'Tầng 1', required: true }
}, { timestamps: false });

// Tạo index kết hợp để đảm bảo table_number duy nhất trong một area
tableInfoSchema.index({ table_number: 1, area: 1 }, { unique: true });

module.exports = mongoose.model('TableInfo', tableInfoSchema);
const mongoose = require('mongoose');

const tableInfoSchema = new mongoose.Schema({
  table_number: { type: Number, required: true, unique: true },
  capacity: { type: Number, required: true }
}, { timestamps: false });

module.exports = mongoose.model('TableInfo', tableInfoSchema);
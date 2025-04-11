const mongoose = require('mongoose');

const reservationTableSchema = new mongoose.Schema({
  reservation_id: { type: mongoose.Schema.Types.ObjectId, ref: 'OrderDetail', required: true },
  table_id: { type: Number, ref: 'TableInfo', required: true },
  start_time: { type: Date, required: true },
  end_time: { type: Date, required: true },
  people_assigned: { type: Number, required: false } // Tùy chọn, nếu vẫn muốn lưu số người
}, { timestamps: false });

module.exports = mongoose.model('ReservationTable', reservationTableSchema);
const mongoose = require('mongoose');

const reservationTableSchema = new mongoose.Schema({
  reservation_id: { type: mongoose.Schema.Types.ObjectId, ref: 'OrderDetail', required: true },
  table_id: { type: mongoose.Schema.Types.ObjectId, ref: 'TableInfo', required: true },
  start_time: { type: Date, required: true },
  end_time: { type: Date, required: true },
  people_assigned: { type: Number, required: false }
}, { timestamps: false });

// Thêm index để tối ưu truy vấn
reservationTableSchema.index({ table_id: 1, start_time: 1, end_time: 1 });
reservationTableSchema.index({ reservation_id: 1 });

module.exports = mongoose.model('ReservationTable', reservationTableSchema);
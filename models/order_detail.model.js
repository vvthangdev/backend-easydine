const mongoose = require('mongoose');

const orderDetailSchema = new mongoose.Schema({
  customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  time: { type: Date, default: Date.now },
  type: { type: String, enum: ['reservation', 'ship'], required: true },
  num_people: { 
    type: Number, 
    min: 1, 
    required: function() { return this.type === 'reservation'; } 
  },
  status: { 
    type: String, 
    enum: ['pending', 'confirmed', 'canceled', 'completed'], 
    default: 'pending' 
  },
  star: { type: Number },
  comment: { type: String, maxLength: 255 }
}, { timestamps: false });

module.exports = mongoose.model('OrderDetail', orderDetailSchema);
const mongoose = require('mongoose');

const itemBannerSchema = new mongoose.Schema({
  image: { type: String, required: true, maxLength: 255 },
  title: { type: String, required: true, maxLength: 255 }
}, { timestamps: false });

module.exports = mongoose.model('ItemBanner', itemBannerSchema);
const reviewService = require('../services/reviewService');

// Tạo đánh giá cho món ăn
exports.createReview = async (req, res) => {
  try {
    const { item_id, order_id, rating, comment } = req.body;
    const user_id = req.user.id; // Lấy user từ middleware (xác thực JWT)

    const review = await reviewService.createReview({ user_id, item_id, order_id, rating, comment });
    res.status(200).json({
      message: 'Review created successfully',
      review
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


//service 

// Lấy danh sách đánh giá cho một món ăn
exports.getItemReviews = async (req, res) => {
  try {
    const itemId = req.params.itemId;
    const reviews = await reviewService.getItemReviews(itemId);
    res.status(200).json(reviews);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Lấy danh sách đánh giá cho một đơn hàng
exports.getOrderReviews = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const reviews = await reviewService.getOrderReviews(orderId);
    res.status(200).json(reviews);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const Review = require('../models/reviewModel');
const Item = require('../models/itemModel');
const Order = require('../models/orderModel');

// Tạo một đánh giá mới
exports.createReview = async ({ user_id, item_id, order_id, rating, comment }) => {
  try {
    // Kiểm tra xem món ăn có tồn tại không
    const item = await Item.findById(item_id);
    if (!item) {
      throw new Error('Item not found');
    }

    // Kiểm tra xem người dùng đã đánh giá món ăn này chưa (một người chỉ có thể đánh giá mỗi món ăn một lần)
    const existingReview = await Review.findOne({ user_id, item_id });
    if (existingReview) {
      throw new Error('You have already reviewed this item');
    }

    const review = new Review({
      user_id,
      item_id,
      order_id, // Có thể không có order_id nếu chỉ đánh giá món ăn
      rating,
      comment
    });

    await review.save();
    return review;
  } catch (error) {
    throw new Error('Error creating review: ' + error.message);
  }
};

// Lấy danh sách đánh giá cho món ăn
exports.getItemReviews = async (itemId) => {
  try {
    const reviews = await Review.find({ item_id: itemId }).populate('user_id', 'email'); // Lấy các đánh giá và thông tin người dùng
    return reviews;
  } catch (error) {
    throw new Error('Error fetching reviews for item: ' + error.message);
  }
};

// Lấy danh sách đánh giá cho đơn hàng
exports.getOrderReviews = async (orderId) => {
  try {
    const reviews = await Review.find({ order_id: orderId }).populate('user_id', 'email'); // Lấy các đánh giá và thông tin người dùng
    return reviews;
  } catch (error) {
    throw new Error('Error fetching reviews for order: ' + error.message);
  }
};

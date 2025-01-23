const Order = require('../models/orderModel');
const Payment = require('../models/paymentModel');
const Item = require('../models/itemModel');

// Tạo đơn hàng mới
exports.createOrder = async (orderData) => {
  try {
    // Lấy thông tin món ăn từ Item model
    const items = await Item.find({ '_id': { $in: orderData.items } });

    // Tính tổng tiền đơn hàng
    const totalPrice = items.reduce((total, item) => total + item.price, 0);

    // Tạo mới đơn hàng
    const newOrder = new Order({
      user_id: orderData.user_id,
      status: 'pending',
      total_price: totalPrice,
      items: orderData.items,
      shipping_info: orderData.shipping_info
    });

    await newOrder.save();
    return newOrder;
  } catch (error) {
    throw new Error('Error creating order: ' + error.message);
  }
};

// Xử lý thanh toán cho đơn hàng
exports.processPayment = async (orderId, paymentDetails) => {
  try {
    // Giả lập thanh toán thành công qua QR
    const paymentStatus = paymentDetails.success ? 'paid' : 'failed';
    
    // Tạo thông tin thanh toán
    const payment = new Payment({
      order_id: orderId,
      payment_method: 'QR_CODE',
      payment_status: paymentStatus,
      transaction_id: paymentDetails.transaction_id,
      paid_at: paymentStatus === 'paid' ? new Date() : null
    });

    await payment.save();

    // Nếu thanh toán thành công, cập nhật trạng thái đơn hàng
    if (paymentStatus === 'paid') {
      const order = await Order.findById(orderId);
      order.status = 'paid';
      await order.save();
    }

    return payment;
  } catch (error) {
    throw new Error('Error processing payment: ' + error.message);
  }
};

// Cập nhật trạng thái đơn hàng
exports.updateOrderStatus = async (orderId, status) => {
  try {
    const order = await Order.findById(orderId);
    if (!order) throw new Error('Order not found');

    order.status = status;
    await order.save();
    return order;
  } catch (error) {
    throw new Error('Error updating order status: ' + error.message);
  }
};

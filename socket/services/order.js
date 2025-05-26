/**
 * Socket Order Service
 * Các hàm chức năng xử lý Socket.IO liên quan đến đơn hàng
 */
const { getIO } = require('../index');

/**
 * Gửi thông báo đơn hàng mới đến admin
 * @param {Object} order - Thông tin đơn hàng
 * @param {Object} user - Thông tin người dùng
 * @returns {Boolean} Kết quả gửi thông báo
 */
const notifyNewOrder = (order, user) => {
  try {
    const io = getIO();
    
    const notification = {
      orderId: order._id.toString(),
      customerId: order.customer_id.toString(),
      type: order.type,
      status: order.status,
      staffId: order.staff_id?.toString() || null,
      time: order.time.toISOString(),
      createdAt: new Date().toISOString(),
      message: `New order ${order._id} created by ${user.username}`,
    };

    console.log('Sending newOrder notification:', notification);
    io.to('adminRoom').emit('newOrder', notification);
    return true;
  } catch (error) {
    console.error('Error sending socket notification:', error.message);
    return false;
  }
};

/**
 * Gửi thông báo cập nhật trạng thái đơn hàng
 * @param {Object} order - Thông tin đơn hàng
 * @param {String} oldStatus - Trạng thái cũ
 * @param {String} userId - ID người dùng thực hiện cập nhật
 * @returns {Boolean} Kết quả gửi thông báo
 */
const notifyOrderStatusUpdate = (order, oldStatus, userId) => {
  try {
    const io = getIO();
    
    const notification = {
      orderId: order._id.toString(),
      oldStatus: oldStatus,
      newStatus: order.status,
      updatedBy: userId,
      updatedAt: new Date().toISOString(),
      message: `Order ${order._id} updated from ${oldStatus} to ${order.status}`,
    };

    console.log('Sending orderStatusUpdate notification:', notification);
    // Gửi đến admin
    io.to('adminRoom').emit('orderStatusUpdate', notification);
    
    // Gửi đến chủ đơn hàng
    io.to(`user:${order.customer_id}`).emit('orderStatusUpdate', notification);
    
    return true;
  } catch (error) {
    console.error('Error sending status update notification:', error.message);
    return false;
  }
};

/**
 * Gửi thông báo cập nhật món ăn trong đơn hàng
 * @param {Object} order - Thông tin đơn hàng
 * @param {Array} items - Danh sách món ăn được thêm
 * @param {Object} user - Thông tin người dùng thực hiện
 * @returns {Boolean} Kết quả gửi thông báo
 */
const notifyOrderItemsUpdate = (order, items, user) => {
  try {
    const io = getIO();

    const notification = {
      orderId: order._id.toString(),
      customerId: order.customer_id.toString(),
      items: items.map(item => ({
        itemId: item.item_id.toString(),
        quantity: item.quantity,
        size: item.size || null,
        note: item.note || '',
      })),
      updatedAt: new Date().toISOString(),
      message: `Order ${order._id} updated with new items by ${user.username}`,
    };

    console.log('Sending orderItemsUpdate notification:', notification);
    // Gửi đến admin
    io.to('adminRoom').emit('orderItemsUpdate', notification);
    // Gửi đến khách hàng
    io.to(`user:${order.customer_id}`).emit('orderItemsUpdate', notification);

    return true;
  } catch (error) {
    console.error('Error sending order items update notification:', error.message);
    return false;
  }
};

module.exports = {
  notifyNewOrder,
  notifyOrderStatusUpdate,
  notifyOrderItemsUpdate,
};
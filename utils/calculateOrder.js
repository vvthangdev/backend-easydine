const mongoose = require("mongoose");
const ItemOrder = require("../models/item_order.model");

async function calculateOrderTotal(orderId, options = {}) {
  const { session } = options;
  try {
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      throw new Error(`Invalid order ID: ${orderId}`);
    }

    const itemOrders = await ItemOrder.find({ order_id: orderId })
      .populate("item_id")
      .session(session);
    if (!itemOrders.length) throw new Error("Đơn hàng không có sản phẩm");

    const totalAmount = itemOrders.reduce((total, itemOrder, index) => {
      if (!itemOrder.item_id) {
        throw new Error(`Sản phẩm không hợp lệ cho ItemOrder ${itemOrder._id}`);
      }
      let price = itemOrder.item_id.price;
      if (itemOrder.size) {
        const selectedSize = itemOrder.item_id.sizes.find(
          (size) => size.name.toLowerCase() === itemOrder.size.toLowerCase()
        );
        if (!selectedSize) {
          throw new Error(
            `Kích thước ${itemOrder.size} không hợp lệ cho sản phẩm ${itemOrder.item_id.name}`
          );
        }
        price = selectedSize.price;
      }
      if (!price && price !== 0) {
        throw new Error(`Sản phẩm ${itemOrder.item_id.name} thiếu giá`);
      }
      const itemTotal = itemOrder.quantity * price;
      return total + itemTotal;
    }, 0);

    if (totalAmount <= 0) {
      throw new Error("Tổng giá trị đơn hàng phải lớn hơn 0");
    }

    return totalAmount;
  } catch (error) {
    console.error(
      `Error calculating order total for ${orderId}:`,
      error.message
    );
    throw error;
  }
}

module.exports = { calculateOrderTotal };

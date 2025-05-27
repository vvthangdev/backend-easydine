require("dotenv").config();
const OrderDetail = require("../models/order_detail.model");
const ReservationTable = require("../models/reservation_table.model");
const TableInfo = require("../models/table_info.model");
const ItemOrder = require("../models/item_order.model");
const { calculateOrderTotal } = require("../services/voucher.service");
const mongoose = require('mongoose');

async function createOrder(orderData, options = {}) {
  try {
    const newOrder = new OrderDetail(orderData);
    await newOrder.save(options.session ? { session: options.session } : {});
    return newOrder;
  } catch (error) {
    console.error("Error saving the order:", error);
    throw new Error("Error saving the order");
  }
}

async function updateOrderAmounts(orderId, session) {
  try {
    const total_amount = await calculateOrderTotal(orderId, { session });
    let discount_amount = 0;
    let final_amount = total_amount;

    const order = await OrderDetail.findById(orderId).session(session);
    if (order.voucher_id) {
      const voucher = await mongoose
        .model("Voucher")
        .findById(order.voucher_id)
        .session(session);
      if (!voucher) throw new Error("Voucher not found!");
      if (voucher.discountType === "percentage") {
        discount_amount = (voucher.discount / 100) * total_amount;
      } else {
        discount_amount = voucher.discount;
      }
      final_amount = total_amount - discount_amount;
      if (final_amount < 0) throw new Error("Final amount cannot be negative!");
    }

    await OrderDetail.findByIdAndUpdate(
      orderId,
      { total_amount, discount_amount, final_amount, updated_at: new Date() },
      { session }
    );
  } catch (error) {
    console.error(
      `Error updating amounts for order ${orderId}:`,
      error.message
    );
    throw error;
  }
}

async function checkUnavailableTables(startTime, endTime, tableIds, excludeOrderId = null, options = {}) {
  try {
    const conditions = {
      table_id: { $in: tableIds.map(id => new mongoose.Types.ObjectId(id)) },
      $or: [
        { start_time: { $lt: endTime }, end_time: { $gt: startTime } }
      ]
    };
    if (excludeOrderId) {
      conditions.reservation_id = { $ne: new mongoose.Types.ObjectId(excludeOrderId) };
    }

    // Lấy danh sách reservation
    const reservations = await ReservationTable.find(
      conditions,
      'reservation_id table_id',
      options.session ? { session: options.session } : {}
    );

    // Gộp truy vấn để kiểm tra trạng thái đơn hàng
    const reservationIds = reservations.map(r => r.reservation_id);
    const orders = await OrderDetail.find(
      { _id: { $in: reservationIds }, status: { $nin: ['completed', 'canceled'] } },
      '_id',
      options.session ? { session: options.session } : {}
    );
    const activeOrderIds = new Set(orders.map(o => o._id.toString()));

    // Lọc các reservation liên quan đến đơn hàng đang hoạt động
    const reservedTables = reservations
      .filter(r => activeOrderIds.has(r.reservation_id.toString()))
      .map(r => r.table_id.toString());

    return [...new Set(reservedTables)]; // Loại bỏ trùng lặp
  } catch (error) {
    console.error("Error checking unavailable tables:", error.message);
    throw new Error(`Failed to check unavailable tables: ${error.message}`);
  }
}

async function createReservations(reservedTables, options = {}) {
  try {
    if (!reservedTables || reservedTables.length === 0) {
      throw new Error('No tables to reserve');
    }

    // Kiểm tra tất cả bàn trong một truy vấn
    const tableIds = reservedTables.map(r => new mongoose.Types.ObjectId(r.table_id));
    const tables = await TableInfo.find(
      { _id: { $in: tableIds } },
      null,
      options.session ? { session: options.session } : {}
    );
    if (tables.length !== tableIds.length) {
      const missingIds = tableIds.filter(id => !tables.some(t => t._id.equals(id)));
      throw new Error(`Tables with IDs ${missingIds.join(', ')} not found`);
    }

    const newReservations = reservedTables.map(({ reservation_id, table_id, start_time, end_time }) => ({
      reservation_id: new mongoose.Types.ObjectId(reservation_id),
      table_id: new mongoose.Types.ObjectId(table_id),
      start_time,
      end_time
    }));

    const createdReservations = await ReservationTable.insertMany(
      newReservations,
      options.session ? { session: options.session } : {}
    );
    return createdReservations;
  } catch (error) {
    console.error('Error creating reservations:', error.message);
    throw new Error(`Failed to create reservations: ${error.message}`);
  }
}

async function createItemOrders(itemOrders, options = {}) {
  try {
    if (!itemOrders || itemOrders.length === 0) {
      return [];
    }
    const createdItemOrders = await ItemOrder.insertMany(itemOrders, options.session ? { session: options.session } : {});
    return createdItemOrders;
  } catch (error) {
    console.error("Error creating item orders:", error);
    throw new Error("Error saving item orders");
  }
}

async function updateOrder(id, data, options = {}) {
  try {
    const order = await OrderDetail.findByIdAndUpdate(id, data, {
      new: true,
      session: options.session || null
    });
    if (!order) return null;
    return order;
  } catch (error) {
    console.log(error);
    throw new Error("Error while updating order");
  }
}

async function getTableById(table_id) {
  try {
    const table = await TableInfo.findById(table_id);
    return table || `Không tìm thấy bàn với ID: ${table_id}`;
  } catch (error) {
    console.error("Lỗi khi truy vấn:", error);
    throw error;
  }
}

async function updateTable(table_id, updatedData) {
  try {
    const table = await TableInfo.findByIdAndUpdate(table_id, updatedData, { new: true });
    if (!table) throw new Error(`Table with ID ${table_id} not found`);
    return table;
  } catch (error) {
    console.log(error);
    throw new Error("Error updating table");
  }
}

module.exports = {
  createOrder,
  createReservations,
  checkUnavailableTables,
  updateTable,
  getTableById,
  createItemOrders,
  updateOrder,
  updateOrderAmounts,
};
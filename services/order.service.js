require("dotenv").config();
const OrderDetail = require("../models/order_detail.model");
const ReservationTable = require("../models/reservation_table.model");
const TableInfo = require("../models/table_info.model");
const ItemOrder = require("../models/item_order.model");

async function createOrder(orderData) {
  try {
    const newOrder = new OrderDetail(orderData);
    await newOrder.save();
    return newOrder;
  } catch (error) {
    console.error("Error saving the order:", error);
    throw new Error("Error saving the order");
  }
}

async function checkUnavailableTables(startTime, endTime, tableIds, excludeOrderId = null) {
  try {
    const conditions = {
      table_id: { $in: tableIds },
      $or: [
        { start_time: { $lt: endTime }, end_time: { $gt: startTime } }
      ]
    };
    if (excludeOrderId) {
      conditions.reservation_id = { $ne: excludeOrderId };
    }

    // Lấy danh sách reservation
    const reservations = await ReservationTable.find(conditions);
    // Lọc các reservation liên quan đến đơn hàng không phải completed hoặc canceled
    const activeReservations = await Promise.all(
      reservations.map(async (reservation) => {
        const order = await OrderDetail.findById(reservation.reservation_id);
        if (order && !['completed', 'canceled'].includes(order.status)) {
          return reservation.table_id;
        }
        return null;
      })
    );

    // Lọc ra các table_id không null (tức là không khả dụng)
    const reservedTables = activeReservations.filter(tableId => tableId !== null);
    return [...new Set(reservedTables)]; // Loại bỏ trùng lặp
  } catch (error) {
    console.error("Error checking unavailable tables:", error);
    throw error;
  }
}

async function createReservations(reservedTables) {
  try {
    if (!reservedTables || reservedTables.length === 0) {
      throw new Error('No tables to reserve');
    }

    const createdReservations = [];
    for (let reservationData of reservedTables) {
      const { reservation_id, table_id, start_time, end_time } = reservationData;

      const table = await TableInfo.findOne({ table_number: table_id });
      if (!table) throw new Error(`Table with number ${table_id} not found`);

      const newReservation = new ReservationTable({
        reservation_id,
        table_id,
        start_time,
        end_time
      });
      await newReservation.save();
      createdReservations.push(newReservation);
    }
    return createdReservations;
  } catch (error) {
    console.error('Error creating reservations:', error);
    throw new Error('Error saving the Reservations');
  }
}

async function createItemOrders(itemOrders) {
  try {
    if (!itemOrders || itemOrders.length === 0) {
      return [];
    }
    const createdItemOrders = await ItemOrder.insertMany(itemOrders);
    return createdItemOrders;
  } catch (error) {
    console.error("Error creating item orders:", error);
    throw new Error("Error saving item orders");
  }
}

async function updateOrder(id, data) {
  try {
    const order = await OrderDetail.findByIdAndUpdate(id, data, { new: true });
    if (!order) return null;
    return order;
  } catch (error) {
    console.log(error);
    throw new Error("Error while updating order");
  }
}

async function getTableByTableNumber(table_number) {
  try {
    const table = await TableInfo.findOne({ table_number });
    return table || `Không tìm thấy bàn với số bàn: ${table_number}`;
  } catch (error) {
    console.error("Lỗi khi truy vấn:", error);
    throw error;
  }
}

async function updateTable(table_number, updatedData) {
  try {
    const table = await TableInfo.findOneAndUpdate({ table_number }, updatedData, { new: true });
    if (!table) throw new Error("Table not found");
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
  getTableByTableNumber,
  createItemOrders,
  updateOrder,
};
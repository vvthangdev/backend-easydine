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

async function checkAvailableTables(startTime, endTime) {
  try {
    const reservedTables = await ReservationTable.find({
      $or: [
        { start_time: { $lt: endTime }, end_time: { $gt: startTime } }
      ]
    }).distinct('table_id');

    const availableTables = await TableInfo.find({
      table_number: { $nin: reservedTables }
    });

    return availableTables.length > 0 ? availableTables : null;
  } catch (error) {
    console.error("Error checking available tables:", error);
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
      const { reservation_id, table_id, start_time, people_assigned } = reservationData;
      const end_time = new Date(start_time);
      end_time.setMinutes(end_time.getMinutes() + (parseInt(process.env.RESERVATION_DURATION_MINUTES) || 120));

      const table = await TableInfo.findOne({ table_number: table_id });
      if (!table) throw new Error(`Table with number ${table_id} not found`);
      if (table.capacity < people_assigned) throw new Error(`Table ${table_id} does not have enough capacity`);

      const newReservation = new ReservationTable({
        reservation_id,
        table_id,
        start_time,
        end_time,
        people_assigned
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
      throw new Error("No items to create");
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
  checkAvailableTables,
  updateTable,
  getTableByTableNumber,
  createItemOrders,
  updateOrder
};
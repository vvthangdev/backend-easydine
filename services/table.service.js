const TableInfo = require("../models/table_info.model");
const ReservationTable = require("../models/reservation_table.model");
const OrderDetail = require("../models/order_detail.model");

async function createTable(tableData) {
  const newTable = new TableInfo(tableData);
  return await newTable.save();
}

async function updateTable(table_number, updatedData) {
  try {
    const table = await TableInfo.findOneAndUpdate(
      { table_number },
      updatedData,
      { new: true }
    );
    if (!table) throw new Error("Table not found");
    return table;
  } catch (error) {
    console.error("Error updating table:", error);
    throw error;
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

async function getAvailableTables(startTime, endTime) {
  try {
    const reservations = await ReservationTable.find({
      $or: [{ start_time: { $lt: endTime }, end_time: { $gt: startTime } }],
    });

    const activeReservations = await Promise.all(
      reservations.map(async (reservation) => {
        const order = await OrderDetail.findById(reservation.reservation_id);

        if (order && !["completed", "canceled"].includes(order.status)) {
          return reservation.table_id;
        }
        return null;
      })
    );

    const reservedTableIds = activeReservations.filter(
      (tableId) => tableId !== null
    );

    const availableTables = await TableInfo.find({
      table_number: { $nin: reservedTableIds },
    });

    return availableTables;
  } catch (error) {
    throw new Error("Error fetching available tables");
  }
}

module.exports = {
  createTable,
  updateTable,
  getTableByTableNumber,
  getAvailableTables,
};

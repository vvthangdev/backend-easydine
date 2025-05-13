const TableInfo = require('../models/table_info.model');
const ReservationTable = require('../models/reservation_table.model');
const OrderDetail = require('../models/order_detail.model');

async function createTable(tableData) {
  try {
    if (!tableData.capacity) {
      throw new Error('Sức chứa là bắt buộc');
    }
    const newTable = new TableInfo(tableData);
    return await newTable.save();
  } catch (error) {
    console.error('Lỗi khi tạo bàn:', error);
    throw error;
  }
}

async function updateTable({ table_id, area }, updatedData) {
  try {
    const table = await TableInfo.findOneAndUpdate(
      { _id: table_id, area },
      updatedData,
      { new: true }
    );
    if (!table) throw new Error('Không tìm thấy bàn');
    return table;
  } catch (error) {
    console.error('Lỗi khi cập nhật bàn:', error);
    throw error;
  }
}

async function getTableByTableId({ table_id }) {
  try {
    const table = await TableInfo.findById(table_id);
    return table || `Không tìm thấy bàn với ID: ${table_id}`;
  } catch (error) {
    console.error('Lỗi khi truy vấn:', error);
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
        if (order && !['completed', 'canceled'].includes(order.status)) {
          return reservation.table_id;
        }
        return null;
      })
    );

    const reservedTableIds = activeReservations.filter((tableId) => tableId !== null);

    const availableTables = await TableInfo.find({
      _id: { $nin: reservedTableIds },
    });

    return availableTables;
  } catch (error) {
    console.error('Lỗi khi lấy danh sách bàn trống:', error);
    throw new Error('Lỗi khi lấy danh sách bàn trống');
  }
}

module.exports = {
  createTable,
  updateTable,
  getTableByTableId,
  getAvailableTables,
};
const TableInfo = require('../models/table_info.model');
const ReservationTable = require('../models/reservation_table.model');
const OrderDetail = require('../models/order_detail.model');

async function createTable(tableData) {
  try {
    // Kiểm tra dữ liệu đầu vào
    if (!tableData.table_number || !tableData.capacity) {
      throw new Error('Số bàn và sức chứa là bắt buộc');
    }
    const newTable = new TableInfo(tableData);
    return await newTable.save();
  } catch (error) {
    console.error('Lỗi khi tạo bàn:', error);
    throw error;
  }
}

async function updateTable({ table_number, area }, updatedData) {
  try {
    const table = await TableInfo.findOneAndUpdate(
      { table_number, area }, // Truy vấn dựa trên cả table_number và area
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

async function getTableByTableNumber({ table_number, area }) {
  try {
    const table = await TableInfo.findOne({ table_number, area });
    return table || `Không tìm thấy bàn với số bàn: ${table_number} ở khu vực: ${area}`;
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

    // Lấy danh sách bàn trống, bao gồm cả trường area
    const availableTables = await TableInfo.find({
      table_number: { $nin: reservedTableIds },
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
  getTableByTableNumber,
  getAvailableTables,
};
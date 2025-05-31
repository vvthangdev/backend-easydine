const TableInfo = require("../models/table_info.model");
const ReservationTable = require("../models/reservation_table.model");
const OrderDetail = require("../models/order_detail.model");

async function createTable(tableData) {
  try {
    if (!tableData.capacity) {
      throw new Error("Sức chứa là bắt buộc");
    }
    const newTable = new TableInfo(tableData);
    return await newTable.save();
  } catch (error) {
    console.error("Lỗi khi tạo bàn:", error);
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
    if (!table) throw new Error("Không tìm thấy bàn");
    return table;
  } catch (error) {
    console.error("Lỗi khi cập nhật bàn:", error);
    throw error;
  }
}

async function getTableByTableId({ table_id }) {
  try {
    const table = await TableInfo.findById(table_id);
    return table || `Không tìm thấy bàn với ID: ${table_id}`;
  } catch (error) {
    console.error("Lỗi khi truy vấn:", error);
    throw error;
  }
}

async function getAvailableTables(startTime, endTime) {
  try {
    const BUFFER_TIME = (parseInt(process.env.BUFFER_TIME) || 15) * 60 * 1000;
    const currentTime = new Date();

    // Kiểm tra định dạng thời gian
    if (
      !(startTime instanceof Date) ||
      !(endTime instanceof Date) ||
      isNaN(startTime) ||
      isNaN(endTime)
    ) {
      throw new Error("startTime và endTime phải là ngày hợp lệ");
    }

    // Tìm các đặt chỗ có khả năng xung đột
    const reservations = await ReservationTable.find({
      $or: [
        { start_time: { $lt: endTime, $gte: startTime } },
        { end_time: { $gt: startTime, $lte: endTime } },
        {
          $and: [
            { start_time: { $lte: startTime } },
            { end_time: { $gte: endTime } },
          ],
        },
      ],
    })
      .select("table_id reservation_id start_time end_time")
      .lean();

    const activeReservations = await Promise.all(
      reservations.map(async (reservation) => {
        const order = await OrderDetail.findById(reservation.reservation_id)
          .select("status type")
          .lean();
        if (!order || ["completed", "canceled"].includes(order.status)) {
          return null; // Bỏ qua nếu đơn hàng không tồn tại hoặc đã hoàn thành/hủy
        }

        // Nếu đặt chỗ online, khách chưa đến, và vượt quá buffer time
        if (
          order.type === "reservation" &&
          order.status === "pending" &&
          currentTime > new Date(reservation.start_time.getTime() + BUFFER_TIME)
        ) {
          // Hủy đơn hàng online
          await OrderDetail.updateOne(
            { _id: reservation.reservation_id },
            { status: "canceled" }
          );
          // Không xóa ReservationTable, trạng thái 'canceled' đã đủ để bỏ qua
          return null; // Bàn được coi là có sẵn
        }

        return reservation.table_id;
      })
    );

    const reservedTableIds = activeReservations.filter(
      (tableId) => tableId !== null
    );

    // Lấy danh sách bàn trống
    const availableTables = await TableInfo.find({
      _id: { $nin: reservedTableIds },
    })
      .select("_id table_number capacity area")
      .lean();

    return availableTables;
  } catch (error) {
    console.error("Lỗi khi lấy danh sách bàn trống:", error);
    throw new Error("Lỗi khi lấy danh sách bàn trống");
  }
}

module.exports = {
  createTable,
  updateTable,
  getTableByTableId,
  getAvailableTables,
};

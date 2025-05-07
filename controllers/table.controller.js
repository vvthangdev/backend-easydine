const TableInfo = require('../models/table_info.model');
const tableService = require('../services/table.service');
const ReservedTable = require('../models/reservation_table.model');
const mongoose = require('mongoose');
const OrderDetail = require('../models/order_detail.model');

const getAllTables = async (req, res) => {
  try {
    const tables = await TableInfo.find();

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Lấy danh sách bàn thành công!',
      data: tables,
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách bàn:', error);
    return res.status(500).json({
      status: 'ERROR',
      message: 'Đã xảy ra lỗi khi lấy danh sách bàn!',
      data: null,
    });
  }
};

const createTable = async (req, res) => {
  try {
    const { table_number, capacity, area } = req.body;

    if (!table_number || !capacity) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Số bàn và sức chứa là bắt buộc!',
        data: null,
      });
    }

    const newTable = await tableService.createTable({ table_number, capacity, area });

    return res.status(201).json({
      status: 'SUCCESS',
      message: 'Tạo bàn thành công!',
      data: newTable,
    });
  } catch (error) {
    console.error('Lỗi khi tạo bàn:', error);
    return res.status(500).json({
      status: 'ERROR',
      message: 'Đã xảy ra lỗi khi tạo bàn!',
      data: null,
    });
  }
};

const updateTable = async (req, res) => {
  try {
    const { table_number, area, ...otherFields } = req.body;

    if (!table_number || !area) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Số bàn và khu vực là bắt buộc!',
        data: null,
      });
    }
    if (!otherFields || Object.keys(otherFields).length === 0) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Không có trường nào để cập nhật!',
        data: null,
      });
    }

    const updatedTable = await tableService.updateTable({ table_number, area }, otherFields);
    if (!updatedTable) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'Không tìm thấy bàn!',
        data: null,
      });
    }

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Cập nhật bàn thành công!',
      data: updatedTable,
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật bàn:', error);
    return res.status(500).json({
      status: 'ERROR',
      message: 'Đã xảy ra lỗi khi cập nhật bàn!',
      data: null,
    });
  }
};

const deleteTable = async (req, res) => {
  try {
    const { table_number, area } = req.body;

    if (!table_number || !area) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Số bàn và khu vực là bắt buộc!',
        data: null,
      });
    }

    const table = await tableService.getTableByTableNumber({ table_number, area });
    if (typeof table === 'string') {
      return res.status(404).json({
        status: 'ERROR',
        message: 'Không tìm thấy bàn!',
        data: null,
      });
    }

    await TableInfo.deleteOne({ table_number, area });

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Xóa bàn thành công!',
      data: null,
    });
  } catch (error) {
    console.error('Lỗi khi xóa bàn:', error);
    return res.status(500).json({
      status: 'ERROR',
      message: 'Đã xảy ra lỗi khi xóa bàn!',
      data: null,
    });
  }
};

const getAllTablesStatus = async (req, res) => {
  try {
    const currentTime = new Date();

    const allTables = await TableInfo.find().lean();

    const activeReservations = await ReservedTable.find({
      start_time: { $lte: currentTime },
      end_time: { $gte: currentTime },
    })
      .populate({
        path: 'reservation_id',
        match: { status: { $in: ['pending', 'confirmed'] } },
        select: '_id status',
      })
      .lean();

    const validReservations = activeReservations.filter((res) => res.reservation_id);

    const tablesWithStatus = allTables.map((table) => {
      const reservation = validReservations.find((res) => res.table_id === table.table_number);
      let status = 'Available';

      if (reservation) {
        status = reservation.reservation_id.status === 'pending' ? 'Reserved' : 'Occupied';
      }

      return {
        table_number: table.table_number,
        capacity: table.capacity,
        area: table.area, // Thêm trường area
        status,
        start_time: reservation ? reservation.start_time : null,
        end_time: reservation ? reservation.end_time : null,
        reservation_id: reservation ? reservation.reservation_id._id.toString() : null,
      };
    });

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Lấy trạng thái bàn thành công!',
      data: tablesWithStatus,
    });
  } catch (error) {
    console.error('Lỗi khi lấy trạng thái bàn:', error);
    return res.status(500).json({
      status: 'ERROR',
      message: 'Đã xảy ra lỗi khi lấy trạng thái bàn!',
      data: null,
    });
  }
};

const releaseTable = async (req, res) => {
  try {
    const { reservation_id, table_id } = req.body;

    if (!reservation_id || !mongoose.Types.ObjectId.isValid(reservation_id)) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'reservation_id hợp lệ là bắt buộc!',
        data: null,
      });
    }
    if (!table_id || isNaN(table_id)) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'table_id hợp lệ là bắt buộc!',
        data: null,
      });
    }

    const order = await OrderDetail.findById(reservation_id);
    if (!order) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'Không tìm thấy đơn hàng!',
        data: null,
      });
    }

    const reservationTable = await ReservedTable.findOne({
      reservation_id,
      table_id,
    });
    if (!reservationTable) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'Không tìm thấy đặt chỗ cho bàn!',
        data: null,
      });
    }

    reservationTable.end_time = new Date();
    await reservationTable.save();

    const tableInfo = await TableInfo.findOne({ table_number: table_id }).lean();
    if (!tableInfo) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'Không tìm thấy bàn!',
        data: null,
      });
    }

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Bàn đã được trả thành công!',
      data: {
        table_number: tableInfo.table_number,
        capacity: tableInfo.capacity,
        area: tableInfo.area, // Thêm trường area
        status: 'Available',
        start_time: reservationTable.start_time,
        end_time: reservationTable.end_time,
      },
    });
  } catch (error) {
    console.error('Lỗi khi trả bàn:', error);
    return res.status(500).json({
      status: 'ERROR',
      message: 'Đã xảy ra lỗi khi trả bàn!',
      data: null,
    });
  }
};

const getAvailableTables = async (req, res) => {
  try {
    const { start_time, end_time } = req.query;

    if (!start_time || !end_time) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'start_time và end_time là bắt buộc!',
        data: null,
      });
    }

    const startTime = new Date(start_time);
    const endTime = new Date(end_time);

    if (isNaN(startTime) || isNaN(endTime)) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Định dạng ngày không hợp lệ!',
        data: null,
      });
    }

    const availableTables = await tableService.getAvailableTables(startTime, endTime);

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Lấy danh sách bàn trống thành công!',
      data: availableTables,
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách bàn trống:', error);
    return res.status(500).json({
      status: 'ERROR',
      message: 'Đã xảy ra lỗi khi lấy danh sách bàn trống!',
      data: null,
    });
  }
};

module.exports = {
  getAllTables,
  createTable,
  updateTable,
  deleteTable,
  getAllTablesStatus,
  releaseTable,
  getAvailableTables,
};
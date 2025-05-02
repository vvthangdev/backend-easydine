const TableInfo = require("../models/table_info.model");
const tableService = require("../services/table.service");
const ReservedTable = require("../models/reservation_table.model")
const mongoose = require('mongoose'); 
const OrderDetail = require("../models/order_detail.model")

const getAllTables = async (req, res) => {
  try {
    const tables = await TableInfo.find();
    res.json(tables);
  } catch (error) {
    res.status(500).json({ error: "Error fetching tables" });
  }
};

const createTable = async (req, res) => {
  try {
    const { ...tableData } = req.body;
    const newTable = await tableService.createTable(tableData);
    res.status(201).json(newTable);
  } catch (error) {
    res.status(500).json({ error: "Error creating table" });
  }
};

const updateTable = async (req, res) => {
  try {
    const { table_number, ...otherFields } = req.body;
    if (!table_number) {
      return res.status(400).send("Table number required.");
    }
    if (!otherFields || Object.keys(otherFields).length === 0) {
      return res.status(400).send("No fields to update.");
    }

    const updatedTable = await tableService.updateTable(table_number, otherFields);
    if (!updatedTable) {
      return res.status(404).send("Table not found!");
    }
    res.json({
      status: "SUCCESS",
      message: "Table updated successfully!",
      Table: updatedTable,
    });
  } catch (error) {
    res.status(500).json({ error: "Error updating table" });
  }
};

const deleteTable = async (req, res) => {
  try {
    const { table_number } = req.body;
    const table = await tableService.getTableByTableNumber(table_number);
    if (typeof table === 'string') { // Nếu trả về chuỗi thông báo "Không tìm thấy..."
      return res.status(404).json({ error: "Table not found" });
    }

    await TableInfo.deleteOne({ table_number });
    res.json({ message: "Table deleted" });
  } catch (error) {
    res.status(500).json({ error: "Error deleting table" });
  }
};

// API lấy trạng thái toàn bộ bàn
const getAllTablesStatus = async (req, res) => {
  try {
    const currentTime = new Date();

    const allTables = await TableInfo.find().lean();

    const activeReservations = await ReservedTable.find({
      start_time: { $lte: currentTime },
      end_time: { $gte: currentTime }
    }).populate({
      path: 'reservation_id',
      match: { status: { $in: ['pending', 'confirmed'] } }
    }).lean();

    const validReservations = activeReservations.filter(res => res.reservation_id);

    const tablesWithStatus = allTables.map(table => {
      const reservation = validReservations.find(res => res.table_id === table.table_number);
      let status = 'Available';

      if (reservation) {
        status = reservation.reservation_id.status === 'pending' ? 'Reserved' : 'Occupied';
      }

      return {
        table_number: table.table_number,
        capacity: table.capacity,
        status,
        start_time: reservation ? reservation.start_time : null,
        end_time: reservation ? reservation.end_time : null,
        reservation_id: reservation ? reservation.reservation_id._id : null // Đảm bảo trả reservation_id
      };
    });

    res.json({
      status: "SUCCESS",
      message: "Lấy trạng thái bàn thành công",
      tables: tablesWithStatus
    });
  } catch (error) {
    console.error("Lỗi khi lấy trạng thái bàn:", error);
    res.status(500).json({ error: "Lỗi khi lấy trạng thái bàn" });
  }
};


// API mới: Trả bàn sớm
const releaseTable = async (req, res) => {
  try {
    const { reservation_id, table_id } = req.body;

    if (!reservation_id || !mongoose.Types.ObjectId.isValid(reservation_id)) {
      return res.status(400).json({ error: "Valid reservation_id is required" });
    }
    if (!table_id || isNaN(table_id)) {
      return res.status(400).json({ error: "Valid table_id is required" });
    }

    // Tìm đơn hàng
    const order = await OrderDetail.findById(reservation_id);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Tìm bản ghi ReservationTable
    const reservationTable = await ReservedTable.findOne({
      reservation_id,
      table_id
    });
    if (!reservationTable) {
      return res.status(404).json({ error: "Table reservation not found" });
    }

    // Cập nhật end_time thành thời gian hiện tại
    reservationTable.end_time = new Date();
    await reservationTable.save();

    // Lấy thông tin bàn để trả về response
    const tableInfo = await TableInfo.findOne({ table_number: table_id }).lean();
    if (!tableInfo) {
      return res.status(404).json({ error: "Table not found" });
    }

    res.json({
      status: "SUCCESS",
      message: "Bàn đã được trả thành công",
      table: {
        table_number: tableInfo.table_number,
        capacity: tableInfo.capacity,
        status: "Available",
        start_time: reservationTable.start_time,
        end_time: reservationTable.end_time
      }
    });
  } catch (error) {
    console.error("Lỗi khi trả bàn:", error);
    res.status(500).json({ error: "Lỗi khi trả bàn" });
  }
};


const getAvailableTables = async (req, res) => {
  try {
    const { start_time, end_time } = req.query;
    if (!start_time || !end_time) {
      return res.status(400).json({ error: "start_time and end_time are required" });
    }
    const startTime = new Date(start_time);
    const endTime = new Date(end_time);
    if (isNaN(startTime) || isNaN(endTime)) {
      return res.status(400).json({ error: "Invalid date format" });
    }
    const availableTables = await tableService.getAvailableTables(startTime, endTime);
    res.status(200).json(availableTables);
  } catch (error) {
    console.error("Error fetching available tables:", error);
    res.status(500).json({ error: "Error fetching available tables" });
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
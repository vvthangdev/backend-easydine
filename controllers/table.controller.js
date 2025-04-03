const TableInfo = require("../models/table_info.model");
const tableService = require("../services/table.service");

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

module.exports = {
  getAllTables,
  createTable,
  updateTable,
  deleteTable,
};
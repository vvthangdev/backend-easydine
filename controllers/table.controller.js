const TableInfo = require("../models/table_info.model");
const tableService = require("../services/table.service");

const getAllTables = async (req, res) => {
  try {
    const tables = await TableInfo.findAll();
    res.json(tables);
  } catch (error) {
    res.status(500).json({ error: "Error fetching tables" });
  }
};

const createTable = async (req, res) => {
  try {
    console.log(req.user)
    const { ...tableData } = req.body;
    const newTable = await tableService.createTable({ ...tableData });
    res.status(201).json(newTable);
  } catch (error) {
    res.status(500).json({ error: "Error creating table" });
  }
};

const updateTable = async (req, res) => {
  try {
    const { table_number, ...otherFields } = req.body; // Adjust as needed to accept relevant fields
    if (!table_number) {
      return res.status(400).send("Table number required.");
    }
    if (!otherFields || Object.keys(otherFields).length === 0) {
      return res.status(400).send("No fields to update.");
    }
    // Update the user information in the database
    const updatedTable = await tableService.updateTable(table_number, {
      ...otherFields, // Spread other fields if there are additional updates
    });

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
    console.log(req.body.table_number)
    const table = await tableService.getTableByTableNumber(req.body.table_number);
    console.log(table)
    if (table) {
      await table.destroy();
      res.json({ message: "Table deleted" });
    } else {
      res.status(404).json({ error: "Table not found" });
    }
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

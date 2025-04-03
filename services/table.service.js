const TableInfo = require("../models/table_info.model");

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

module.exports = {
  createTable,
  updateTable,
  getTableByTableNumber,
};
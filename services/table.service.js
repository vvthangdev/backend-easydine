const TableInfo = require("../models/table_info.model");

async function createTable(tableData) {
  const newTable = new TableInfo({
    ...tableData,
  });
  return newTable.save();
}

const updateTable = async (table_number, updatedData) => {
  // Tìm người dùng theo username
  const table = await TableInfo.findOne({ where: { table_number } });

  // Kiểm tra nếu người dùng tồn tại
  if (!table) {
    throw new Error("Table not found");
  }

  // Cập nhật thông tin người dùng
  Object.assign(table, updatedData);
  await table.save(); // Lưu cập nhật vào cơ sở dữ liệu

  return table;
};

async function getTableByTableNumber(table_number) {
  try {
    // Truy vấn cơ sở dữ liệu để tìm bản ghi có table_number tương ứng
    const table = await TableInfo.findOne({
      where: { table_number: table_number },
    });

    // Nếu không tìm thấy, trả về thông báo hoặc null
    if (!table) {
      return `Không tìm thấy bàn với số bàn: ${table_number}`;
    }

    // Trả về đối tượng table (TableInfo)
    return table;
  } catch (error) {
    // Xử lý lỗi nếu có
    console.error("Lỗi khi truy vấn:", error);
    throw error; // Ném lỗi ra ngoài
  }
}

module.exports = {
  createTable,
  updateTable,
  getTableByTableNumber,
};

const ItemOrd = require("../models/item_order.model");
const { Op } = require("sequelize");

async function createItemOrd(itemOrdData) {
  const newItemOrd = new ItemOrd({
    ...itemOrdData,
  });
  return newItemOrd.save();
}

const updateItemOrd = async (id, updatedData) => {
  const itemOrd = await ItemOrd.findOne({ where: { id } });

  if (!itemOrd) {
    throw new Error("ItemOrd not found");
  }

  Object.assign(itemOrd, updatedData);
  await itemOrd.save(); // Lưu cập nhật vào cơ sở dữ liệu

  return itemOrd;
};

async function getItemOrdByItemOrdId(id) {
  try {
    // Truy vấn cơ sở dữ liệu để tìm bản ghi có itemOrd_id tương ứng
    const itemOrd = await ItemOrd.findOne({
      where: { id: id },
    });

    // Nếu không tìm thấy, trả về thông báo hoặc null
    if (!itemOrd) {
      return `Không tìm thấy bàn với số bàn: ${id}`;
    }

    // Trả về đối tượng itemOrd (ItemOrd)
    return itemOrd;
  } catch (error) {
    // Xử lý lỗi nếu có
    console.error("Lỗi khi truy vấn:", error);
    throw error; // Ném lỗi ra ngoài
  }
}

async function searchItemOrd(criteria) {
  // Tạo mảng điều kiện `where` dựa trên các thuộc tính có trong `criteria`
  const conditions = [];

  if (criteria.id) {
    conditions.push({ id: criteria.id });
  }
  if (criteria.name) {
    conditions.push({ name: criteria.name });
  }
  if (criteria.image) {
    conditions.push({ image: criteria.image });
  }
  if (criteria.price) {
    conditions.push({ price: criteria.price });
  }
  console.log(conditions);

  // Nếu không có điều kiện nào được cung cấp, trả về `false` ngay lập tức
  if (conditions.length === 0) {
    return false;
  }

  // Thực hiện truy vấn với điều kiện `Op.or` để kiểm tra sự tồn tại
  const result = await ItemOrd.findAll({
    where: {
      [Op.or]: conditions,
    },
  });
  console.log(result);
  return result;
}

module.exports = {
  createItemOrd,
  updateItemOrd,
  getItemOrdByItemOrdId,
  searchItemOrd,
};

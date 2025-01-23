const Item = require("../models/item.model");
const { Op } = require("sequelize");

async function createItem(itemData) {
  const newItem = new Item({
    ...itemData,
  });
  return newItem.save();
}

const updateItem = async (id, updatedData) => {
  const item = await Item.findOne({ where: { id } });

  if (!item) {
    throw new Error("Item not found");
  }

  Object.assign(item, updatedData);
  await item.save(); // Lưu cập nhật vào cơ sở dữ liệu

  return item;
};

async function getItemByItemId(id) {
  try {
    // Truy vấn cơ sở dữ liệu để tìm bản ghi có item_id tương ứng
    const item = await Item.findOne({
      where: { id: id },
    });

    // Nếu không tìm thấy, trả về thông báo hoặc null
    if (!item) {
      return `Không tìm thấy bàn với số bàn: ${id}`;
    }

    // Trả về đối tượng item (Item)
    return item;
  } catch (error) {
    // Xử lý lỗi nếu có
    console.error("Lỗi khi truy vấn:", error);
    throw error; // Ném lỗi ra ngoài
  }
}

async function searchItem(criteria) {
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
  const result = await Item.findAll({
    where: {
      [Op.or]: conditions,
    },
  });
  console.log(result);
  return result;
}

module.exports = {
  createItem,
  updateItem,
  getItemByItemId,
  searchItem,
};

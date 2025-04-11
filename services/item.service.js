const Item = require("../models/item.model");

async function createItem(itemData) {
  const newItem = new Item(itemData);
  return await newItem.save();
}

async function updateItem(id, updatedData) {
  try {
    const item = await Item.findByIdAndUpdate(id, updatedData, { new: true }).populate('categories');
    if (!item) throw new Error("Item not found");
    return item;
  } catch (error) {
    console.error("Error updating item:", error);
    throw error;
  }
}

async function getItemByItemId(id) {
  try {
    const item = await Item.findById(id).populate('categories');
    return item || `Không tìm thấy món với ID: ${id}`;
  } catch (error) {
    console.error("Lỗi khi truy vấn:", error);
    throw error;
  }
}

async function searchItem(criteria) {
  const conditions = {};

  if (criteria.id) conditions._id = criteria.id;

  if (criteria.name) {
    const searchTerm = removeVietnameseAccents(criteria.name); // Bỏ dấu từ khóa tìm kiếm
    // Tìm trên nameNoAccents, không phân biệt hoa/thường
    conditions.nameNoAccents = { $regex: new RegExp(searchTerm, "i") };
  }

  if (criteria.image) conditions.image = criteria.image;
  if (criteria.price) conditions.price = criteria.price;
  if (criteria.categories) conditions.categories = { $in: criteria.categories };

  if (Object.keys(conditions).length === 0) return false;

  const result = await Item.find(conditions).populate("categories");
  return result;
}

function removeVietnameseAccents(str) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

module.exports = {
  createItem,
  updateItem,
  getItemByItemId,
  searchItem,
};
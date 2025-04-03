const Item = require("../models/item.model");

async function createItem(itemData) {
  const newItem = new Item(itemData);
  return await newItem.save();
}

async function updateItem(id, updatedData) {
  try {
    const item = await Item.findByIdAndUpdate(id, updatedData, { new: true });
    if (!item) throw new Error("Item not found");
    return item;
  } catch (error) {
    console.error("Error updating item:", error);
    throw error;
  }
}

async function getItemByItemId(id) {
  try {
    const item = await Item.findById(id);
    return item || `Không tìm thấy món với ID: ${id}`;
  } catch (error) {
    console.error("Lỗi khi truy vấn:", error);
    throw error;
  }
}

async function searchItem(criteria) {
  const conditions = {};
  if (criteria.id) conditions._id = criteria.id;
  if (criteria.name) conditions.name = criteria.name;
  if (criteria.image) conditions.image = criteria.image;
  if (criteria.price) conditions.price = criteria.price;

  if (Object.keys(conditions).length === 0) return false;

  const result = await Item.find(conditions);
  return result;
}

module.exports = {
  createItem,
  updateItem,
  getItemByItemId,
  searchItem,
};
const ItemOrder = require("../models/item_order.model");

async function createItemOrd(itemOrdData) {
  const newItemOrd = new ItemOrder({
    ...itemOrdData,
  });
  return await newItemOrd.save();
}

const updateItemOrd = async (id, updatedData) => {
  const itemOrd = await ItemOrder.findById(id);

  if (!itemOrd) {
    throw new Error("ItemOrd not found");
  }

  Object.assign(itemOrd, updatedData);
  return await itemOrd.save(); // Lưu cập nhật vào MongoDB
};

async function getItemOrdByItemOrdId(id) {
  try {
    const itemOrd = await ItemOrder.findById(id);
    if (!itemOrd) {
      return `Không tìm thấy bản ghi với id: ${id}`;
    }
    return itemOrd;
  } catch (error) {
    console.error("Lỗi khi truy vấn:", error);
    throw error;
  }
}

async function searchItemOrd(criteria) {
  const conditions = {};

  if (criteria.id) conditions._id = criteria.id;
  if (criteria.item_id) conditions.item_id = criteria.item_id;
  if (criteria.quantity) conditions.quantity = criteria.quantity;
  if (criteria.order_id) conditions.order_id = criteria.order_id;

  if (Object.keys(conditions).length === 0) {
    return false;
  }

  const result = await ItemOrder.find(conditions);
  return result;
}

module.exports = {
  createItemOrd,
  updateItemOrd,
  getItemOrdByItemOrdId,
  searchItemOrd,
};
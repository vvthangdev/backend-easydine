const ItemOrder = require("../models/item_order.model");
const itemOrdService = require("../services/item_order.service");

const getAllItemOrds = async (req, res) => {
  try {
    const itemOrds = await ItemOrder.find(); // Lấy tất cả bản ghi
    res.json(itemOrds);
  } catch (error) {
    res.status(500).json({ error: "Error fetching itemOrds" });
  }
};

const createItemOrd = async (req, res) => {
  try {
    const { ...itemOrdData } = req.body;
    const newItemOrd = await itemOrdService.createItemOrd({ ...itemOrdData });
    res.status(201).json(newItemOrd);
  } catch (error) {
    res.status(500).json({ error: "Error creating itemOrd" });
  }
};

const updateItemOrd = async (req, res) => {
  try {
    const { id, ...otherFields } = req.body;
    if (!id) {
      return res.status(400).send("ItemOrd id required.");
    }
    if (!otherFields || Object.keys(otherFields).length === 0) {
      return res.status(400).send("No fields to update.");
    }

    const updatedItemOrd = await itemOrdService.updateItemOrd(id, {
      ...otherFields,
    });

    if (!updatedItemOrd) {
      return res.status(404).send("ItemOrd not found!");
    }
    res.json({
      status: "SUCCESS",
      message: "ItemOrd updated successfully!",
      ItemOrd: updatedItemOrd,
    });
  } catch (error) {
    res.status(500).json({ error: "Error updating itemOrd" });
  }
};

const deleteItemOrd = async (req, res) => {
  try {
    const { id } = req.body;
    const itemOrd = await itemOrdService.getItemOrdByItemOrdId(id);
    if (typeof itemOrd === "string") { // Kiểm tra nếu trả về thông báo lỗi
      return res.status(404).json({ error: "ItemOrd not found" });
    }

    await ItemOrder.deleteOne({ _id: id });
    res.json({ message: "ItemOrd deleted" });
  } catch (error) {
    res.status(500).json({ error: "Error deleting itemOrd" });
  }
};

module.exports = {
  getAllItemOrds,
  createItemOrd,
  updateItemOrd,
  deleteItemOrd,
};
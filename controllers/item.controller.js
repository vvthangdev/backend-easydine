const Item = require("../models/item.model");
const ItemBanner = require("../models/itembanner.model");
const itemService = require("../services/item.service");

const getAllItems = async (req, res) => {
  try {
    const items = await Item.find();
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: "Error fetching items" });
  }
};

const getItemBanner = async (req, res) => {
  try {
    const items = await ItemBanner.find();
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: "Error fetching item banners" });
  }
};

const createItem = async (req, res) => {
  try {
    const { ...itemData } = req.body;
    const newItem = await itemService.createItem(itemData);
    res.status(201).json(newItem);
  } catch (error) {
    res.status(500).json({ error: "Error creating item" });
  }
};

const createItemBanner = async (req, res) => {
  try {
    const { image, title } = req.body;
    if (!image || !title) {
      return res.status(400).json({ error: "Image and title are required." });
    }

    const newItemBanner = new ItemBanner({ image, title });
    await newItemBanner.save();
    res.status(201).json(newItemBanner);
  } catch (error) {
    console.error("Error creating item banner:", error);
    res.status(500).json({ error: "Error creating item banner" });
  }
};

const updateItem = async (req, res) => {
  try {
    const { id, ...otherFields } = req.body;
    if (!id) return res.status(400).send("Item id required.");
    if (!otherFields || Object.keys(otherFields).length === 0) {
      return res.status(400).send("No fields to update.");
    }

    const updatedItem = await itemService.updateItem(id, otherFields);
    if (!updatedItem) return res.status(404).send("Item not found!");

    res.json({
      status: "SUCCESS",
      message: "Item updated successfully!",
      Item: updatedItem,
    });
  } catch (error) {
    res.status(500).json({ error: "Error updating item" });
  }
};

const searchItem = async (req, res) => {
  try {
    let { ...otherFields } = req.body;
    if (!otherFields || Object.keys(otherFields).length === 0) {
      return res.status(400).send("Item info required.");
    }

    const items = await itemService.searchItem(otherFields);
    res.status(200).json({ item: items });
  } catch (error) {
    res.status(500).json({ error: "Error fetching item" });
  }
};

const deleteItem = async (req, res) => {
  try {
    const { id } = req.body;
    const item = await itemService.getItemByItemId(id);
    if (typeof item === 'string') {
      return res.status(404).json({ error: "Item not found" });
    }

    await Item.findByIdAndDelete(id);
    res.json({ message: "Item deleted" });
  } catch (error) {
    res.status(500).json({ error: "Error deleting item" });
  }
};

module.exports = {
  getAllItems,
  getItemBanner,
  createItem,
  createItemBanner,
  updateItem,
  searchItem,
  deleteItem,
};
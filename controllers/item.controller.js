const ItemInfo = require("../models/item.model");
const itemService = require("../services/item.service");
const ItemBanner = require("../models/itembanner")

const getAllItems = async (req, res) => {
  try {
    const items = await ItemInfo.findAll();
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: "Error fetching items" });
  }
};

const getItemBanner = async (req, res) => {
  try {
    const items = await ItemBanner.findAll();
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: "Error fetching items" });
  }
};

const createItem = async (req, res) => {
  try {
    const { ...itemData } = req.body;
    const newItem = await itemService.createItem({ ...itemData });
    res.status(201).json(newItem);
  } catch (error) {
    res.status(500).json({ error: "Error creating item" });
  }
};

const createItemBanner = async (req, res) => {
  try {
    const { image, title } = req.body;

    // Kiểm tra dữ liệu đầu vào
    if (!image || !title) {
      return res.status(400).json({ error: "Image and title are required." });
    }

    // Tạo ItemBanner mới
    const newItem = await ItemBanner.create({
      image,
      title,
    });

    // Trả về phản hồi
    res.status(201).json(newItem);
  } catch (error) {
    console.error("Error creating item:", error); // Log lỗi để dễ gỡ lỗi
    res.status(500).json({ error: "Error creating item" });
  }
};


const updateItem = async (req, res) => {
  try {
    const { id, ...otherFields } = req.body; // Adjust as needed to accept relevant fields
    if (!id) {
      return res.status(400).send("Item id required.");
    }
    if (!otherFields || Object.keys(otherFields).length === 0) {
      return res.status(400).send("No fields to update.");
    }
    // Update the user information in the database
    const updatedItem = await itemService.updateItem(id, {
      ...otherFields, // Spread other fields if there are additional updates
    });

    if (!updatedItem) {
      return res.status(404).send("Item not found!");
    }
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
//   console.log(req.body);
  try {
    let { ...otherFields } = req.body; // Adjust as needed to accept relevant fields
    // console.log(otherFields);

    if (!otherFields || Object.keys(otherFields).length === 0) {
      return res.status(400).send("Item info required.");
    }

    const item = await itemService.searchItem(...otherFields);

    // Update the user information in the database
    // const updatedUser = await userService.updateUser(req.user.username, {
    //   ...otherFields, // Spread other fields if there are additional updates
    // });

    // if (!updatedUser) {
    //   return res.status(404).send("User not found!");
    // }
    console.log(item);
    res.status(200).json({ item: item });
  } catch (error) {
    res.status(500).json({ error: "Error fetching item" });
  }
};

const deleteItem = async (req, res) => {
  try {
    console.log(req.body.id);
    const item = await itemService.getItemByItemId(req.body.id);
    if (item) {
      await item.destroy();
      res.json({ message: "Item deleted" });
    } else {
      res.status(404).json({ error: "Item not found" });
    }
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

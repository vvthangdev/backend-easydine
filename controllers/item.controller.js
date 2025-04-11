const Item = require("../models/item.model");
const ItemBanner = require("../models/itembanner.model");
const Category = require("../models/category.model"); // Thêm model Category
const itemService = require("../services/item.service");

// Hàm mới: Xóa danh mục
const deleteCategory = async (req, res) => {
  try {
    const { categoryId } = req.body;
    if (!categoryId) {
      return res.status(400).json({ error: "Category ID is required" });
    }

    // Kiểm tra danh mục có tồn tại không
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    // Xóa danh mục khỏi mảng categories của các món ăn
    await Item.updateMany(
      { categories: categoryId }, // Tìm các món ăn có categoryId trong mảng categories
      { $pull: { categories: categoryId } } // Xóa categoryId khỏi mảng
    );

    // Xóa danh mục
    await Category.findByIdAndDelete(categoryId);

    res.json({
      message: "Category deleted and removed from items successfully",
    });
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(500).json({ error: "Error deleting category" });
  }
};

// Hàm mới: Tạo danh mục
const createCategory = async (req, res) => {
  try {
    const { name, description, image } = req.body;

    // Kiểm tra trường bắt buộc
    if (!name) {
      return res.status(400).json({ error: "Category name is required" });
    }

    // Kiểm tra xem danh mục đã tồn tại chưa
    const existingCategory = await Category.findOne({ name });
    if (existingCategory) {
      return res.status(400).json({ error: "Category already exists" });
    }

    const newCategory = new Category({ name, description, image });
    await newCategory.save();
    res.status(201).json(newCategory);
  } catch (error) {
    console.error("Error creating category:", error);
    res.status(500).json({ error: "Error creating category" });
  }
};

const getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: "Error fetching categories" });
  }
};

const getAllItems = async (req, res) => {
  try {
    const items = await Item.find().populate("categories"); // Populate để lấy thông tin danh mục
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
    const { name, image, price, categories } = req.body;

    // Kiểm tra các trường bắt buộc
    if (
      !name ||
      !image ||
      !price ||
      !categories ||
      !Array.isArray(categories)
    ) {
      return res.status(400).json({
        error: "Name, image, price, and categories (array) are required",
      });
    }

    // Kiểm tra xem các category ID có hợp lệ không
    const validCategories = await Category.find({ _id: { $in: categories } });
    if (validCategories.length !== categories.length) {
      return res
        .status(400)
        .json({ error: "One or more category IDs are invalid" });
    }

    const newItem = await itemService.createItem({
      name,
      image,
      price,
      categories,
    });
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
    const { id, name, image, price, categories } = req.body;
    if (!id) return res.status(400).send("Item ID required.");

    const updateData = {};
    if (name) updateData.name = name;
    if (image) updateData.image = image;
    if (price) updateData.price = price;
    if (categories) {
      const validCategories = await Category.find({ _id: { $in: categories } });
      if (validCategories.length !== categories.length) {
        return res
          .status(400)
          .json({ error: "One or more category IDs are invalid" });
      }
      updateData.categories = categories;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).send("No fields to update.");
    }

    const updatedItem = await itemService.updateItem(id, updateData);
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
    const otherFields = { ...req.query };
    if (!otherFields || Object.keys(otherFields).length === 0) {
      return res.status(400).send("At least one item info is required.");
    }

    if (otherFields.name) {
      otherFields.name = decodeURIComponent(
        otherFields.name.replace(/\+/g, " ")
      );
    }

    if (otherFields.categories) {
      otherFields.categories = Array.isArray(otherFields.categories)
        ? otherFields.categories
        : otherFields.categories.split(",");
    }

    const items = await itemService.searchItem(otherFields);
    if (!items) {
      return res
        .status(404)
        .json({ message: "No items found matching the criteria" });
    }

    res.status(200).json({ item: items });
  } catch (error) {
    res.status(500).json({ error: "Error fetching item" });
  }
};

const deleteItem = async (req, res) => {
  try {
    const { id } = req.body;
    const item = await itemService.getItemByItemId(id);
    if (typeof item === "string") {
      return res.status(404).json({ error: "Item not found" });
    }

    await Item.findByIdAndDelete(id);
    res.json({ message: "Item deleted" });
  } catch (error) {
    res.status(500).json({ error: "Error deleting item" });
  }
};

// API mới: Lọc món ăn theo danh mục
const filterItemsByCategory = async (req, res) => {
  try {
    const { categoryId } = req.query; // Lấy categoryId từ query string
    if (!categoryId) {
      return res.status(400).json({ error: "Category ID is required" });
    }

    // Kiểm tra categoryId có hợp lệ không
    const categoryExists = await Category.findById(categoryId);
    if (!categoryExists) {
      return res.status(404).json({ error: "Category not found" });
    }

    const items = await Item.find({ categories: categoryId }).populate(
      "categories"
    );
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: "Error filtering items by category" });
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
  filterItemsByCategory,
  createCategory,
  getAllCategories,
  deleteCategory,
};

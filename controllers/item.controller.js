const Item = require("../models/item.model");
const ItemBanner = require("../models/itembanner.model");
const Category = require("../models/category.model");
const itemService = require("../services/item.service");

const createCategory = async (req, res) => {
  try {
    const { name, description, image } = req.body;
    if (!name) return res.status(400).json({ error: "Tên danh mục là bắt buộc" });
    const existingCategory = await Category.findOne({ name });
    if (existingCategory) return res.status(400).json({ error: "Danh mục đã tồn tại" });
    const newCategory = new Category({ name, description, image });
    await newCategory.save();
    res.status(201).json(newCategory);
  } catch (error) {
    console.error("Lỗi khi tạo danh mục:", error);
    res.status(500).json({ error: "Lỗi khi tạo danh mục" });
  }
};

const getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: "Lỗi khi lấy danh mục" });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const { categoryId } = req.body;
    if (!categoryId) return res.status(400).json({ error: "ID danh mục là bắt buộc" });
    const category = await Category.findById(categoryId);
    if (!category) return res.status(404).json({ error: "Không tìm thấy danh mục" });
    await Item.updateMany({ categories: categoryId }, { $pull: { categories: categoryId } });
    await Category.findByIdAndDelete(categoryId);
    res.json({ message: "Xóa danh mục và cập nhật món ăn thành công" });
  } catch (error) {
    console.error("Lỗi khi xóa danh mục:", error);
    res.status(500).json({ error: "Lỗi khi xóa danh mục" });
  }
};

const getAllItems = async (req, res) => {
  try {
    const items = await Item.find().populate("categories");
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: "Lỗi khi lấy món ăn" });
  }
};

const getItemBanner = async (req, res) => {
  try {
    const items = await ItemBanner.find();
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: "Lỗi khi lấy banner món ăn" });
  }
};

const createItem = async (req, res) => {
  try {
    const { name, price, description, image, categories, sizes } = req.body;
    if (!name || !price) {
      return res.status(400).json({ error: "Tên và giá là bắt buộc" });
    }
    if (categories && !Array.isArray(categories)) {
      return res.status(400).json({ error: "Danh mục phải là mảng" });
    }
    if (categories && categories.length > 0) {
      const validCategories = await Category.find({ _id: { $in: categories } });
      if (validCategories.length !== categories.length) {
        return res.status(400).json({ error: "Một hoặc nhiều ID danh mục không hợp lệ" });
      }
    }
    if (sizes && !Array.isArray(sizes)) {
      return res.status(400).json({ error: "Kích cỡ phải là mảng" });
    }
    if (sizes) {
      for (const size of sizes) {
        if (!size.name || !size.price || size.price < 0) {
          return res.status(400).json({ error: "Mỗi kích cỡ phải có tên và giá hợp lệ" });
        }
      }
    }
    const newItem = await itemService.createItem({
      name,
      price,
      description,
      image,
      categories: categories || [],
      sizes: sizes || [],
    });
    res.status(201).json(newItem);
  } catch (error) {
    console.error("Lỗi khi tạo món ăn:", error);
    res.status(500).json({ error: "Lỗi khi tạo món ăn" });
  }
};

const createItemBanner = async (req, res) => {
  try {
    const { image, title } = req.body;
    if (!image || !title) return res.status(400).json({ error: "Hình ảnh và tiêu đề là bắt buộc" });
    const newItemBanner = new ItemBanner({ image, title });
    await newItemBanner.save();
    res.status(201).json(newItemBanner);
  } catch (error) {
    console.error("Lỗi khi tạo banner món ăn:", error);
    res.status(500).json({ error: "Lỗi khi tạo banner món ăn" });
  }
};

const updateItem = async (req, res) => {
  try {
    const { id, name, price, description, image, categories, sizes } = req.body;
    if (!id) return res.status(400).send("ID món ăn là bắt buộc");

    const updateData = {};
    if (name) updateData.name = name;
    if (price !== undefined) updateData.price = price;
    if (description !== undefined) updateData.description = description;
    if (image !== undefined) updateData.image = image;
    if (categories !== undefined) {
      if (categories && !Array.isArray(categories)) {
        return res.status(400).json({ error: "Danh mục phải là mảng" });
      }
      if (categories.length > 0) {
        const validCategories = await Category.find({ _id: { $in: categories } });
        if (validCategories.length !== categories.length) {
          return res.status(400).json({ error: "Một hoặc nhiều ID danh mục không hợp lệ" });
        }
      }
      updateData.categories = categories;
    }
    if (sizes !== undefined) {
      if (sizes && !Array.isArray(sizes)) return res.status(400).json({ error: "Kích cỡ phải là mảng" });
      if (sizes) {
        for (const size of sizes) {
          if (!size.name || !size.price || size.price < 0) {
            return res.status(400).json({ error: "Mỗi kích cỡ phải có tên và giá hợp lệ" });
          }
        }
      }
      updateData.sizes = sizes;
    }

    if (Object.keys(updateData).length === 0) return res.status(400).send("Không có trường nào để cập nhật");

    const updatedItem = await itemService.updateItem(id, updateData);
    if (!updatedItem) return res.status(404).send("Không tìm thấy món ăn");

    res.json({
      status: "SUCCESS",
      message: "Cập nhật món ăn thành công",
      Item: updatedItem,
    });
  } catch (error) {
    console.error("Lỗi khi cập nhật món ăn:", error);
    res.status(500).json({ error: "Lỗi khi cập nhật món ăn" });
  }
};

const searchItem = async (req, res) => {
  try {
    const otherFields = { ...req.query };
    if (!otherFields || Object.keys(otherFields).length === 0) {
      return res.status(400).send("Cần ít nhất một thông tin món ăn");
    }
    if (otherFields.name) {
      otherFields.name = decodeURIComponent(otherFields.name.replace(/\+/g, " "));
    }
    if (otherFields.categories) {
      otherFields.categories = Array.isArray(otherFields.categories)
        ? otherFields.categories
        : otherFields.categories.split(",");
    }
    const items = await itemService.searchItem(otherFields);
    if (!items) return res.status(404).json({ message: "Không tìm thấy món ăn nào phù hợp" });
    res.status(200).json({ item: items });
  } catch (error) {
    console.error("Lỗi khi tìm kiếm món ăn:", error);
    res.status(500).json({ error: "Lỗi khi tìm kiếm món ăn" });
  }
};

const deleteItem = async (req, res) => {
  try {
    const { id } = req.body;
    const item = await itemService.getItemByItemId(id);
    if (typeof item === "string") return res.status(404).json({ error: "Không tìm thấy món ăn" });
    await Item.findByIdAndDelete(id);
    res.json({ message: "Xóa món ăn thành công" });
  } catch (error) {
    console.error("Lỗi khi xóa món ăn:", error);
    res.status(500).json({ error: "Lỗi khi xóa món ăn" });
  }
};

const filterItemsByCategory = async (req, res) => {
  try {
    const { categoryId } = req.query;
    if (!categoryId) return res.status(400).json({ error: "ID danh mục là bắt buộc" });
    const categoryExists = await Category.findById(categoryId);
    if (!categoryExists) return res.status(404).json({ error: "Không tìm thấy danh mục" });
    const items = await Item.find({ categories: categoryId }).populate("categories");
    res.json(items);
  } catch (error) {
    console.error("Lỗi khi lọc món ăn theo danh mục:", error);
    res.status(500).json({ error: "Lỗi khi lọc món ăn theo danh mục" });
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
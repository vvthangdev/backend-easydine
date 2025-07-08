const Item = require("../models/item.model");
const ItemBanner = require("../models/itembanner.model");
const Category = require("../models/category.model");
const itemService = require("../services/item.service");

const createCategory = async (req, res) => {
  try {
    const { name, description, image } = req.body;

    if (!name) {
      return res.status(400).json({
        status: "ERROR",
        message: "Category name is required!",
        data: null,
      });
    }

    const existingCategory = await Category.findOne({ name });
    if (existingCategory) {
      return res.status(400).json({
        status: "ERROR",
        message: "Category already exists!",
        data: null,
      });
    }

    const newCategory = new Category({ name, description, image });
    await newCategory.save();

    return res.status(201).json({
      status: "SUCCESS",
      message: "Category created successfully!",
      data: newCategory,
    });
  } catch (error) {
    console.error("Error creating category:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "An error occurred while creating the category!",
      data: null,
    });
  }
};

const getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find();

    return res.status(200).json({
      status: "SUCCESS",
      message: "Categories retrieved successfully!",
      data: categories,
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "An error occurred while fetching categories!",
      data: null,
    });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const { categoryId } = req.body;

    if (!categoryId) {
      return res.status(400).json({
        status: "ERROR",
        message: "Category ID is required!",
        data: null,
      });
    }

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        status: "ERROR",
        message: "Category not found!",
        data: null,
      });
    }

    await Item.updateMany({ categories: categoryId }, { $pull: { categories: categoryId } });
    await Category.findByIdAndDelete(categoryId);

    return res.status(200).json({
      status: "SUCCESS",
      message: "Category deleted successfully!",
      data: null,
    });
  } catch (error) {
    console.error("Error deleting category:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "An error occurred while deleting the category!",
      data: null,
    });
  }
};

const getAllItems = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const items = await Item.find({})
      .skip(skip)
      .limit(limit);

    const total = await Item.countDocuments();

    return res.status(200).json({
      status: "SUCCESS",
      message: "Items retrieved successfully!",
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching items:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "An error occurred while fetching items!",
      data: null,
    });
  }
};

const getItemBanner = async (req, res) => {
  try {
    const items = await ItemBanner.find();

    return res.status(200).json({
      status: "SUCCESS",
      message: "Item banners retrieved successfully!",
      data: items,
    });
  } catch (error) {
    console.error("Error fetching item banners:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "An error occurred while fetching item banners!",
      data: null,
    });
  }
};

const createItem = async (req, res) => {
  try {
    const { name, price, description, image, categories, sizes } = req.body;

    if (!name || !price) {
      return res.status(400).json({
        status: "ERROR",
        message: "Name and price are required!",
        data: null,
      });
    }

    if (categories && !Array.isArray(categories)) {
      return res.status(400).json({
        status: "ERROR",
        message: "Categories must be an array!",
        data: null,
      });
    }

    if (categories && categories.length > 0) {
      const validCategories = await Category.find({ _id: { $in: categories } });
      if (validCategories.length !== categories.length) {
        return res.status(400).json({
          status: "ERROR",
          message: "One or more category IDs are invalid!",
          data: null,
        });
      }
    }

    if (sizes && !Array.isArray(sizes)) {
      return res.status(400).json({
        status: "ERROR",
        message: "Sizes must be an array!",
        data: null,
      });
    }

    if (sizes) {
      for (const size of sizes) {
        if (!size.name || !size.price || size.price < 0) {
          return res.status(400).json({
            status: "ERROR",
            message: "Each size must have a valid name and price!",
            data: null,
          });
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

    return res.status(201).json({
      status: "SUCCESS",
      message: "Item created successfully!",
      data: newItem,
    });
  } catch (error) {
    console.error("Error creating item:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "An error occurred while creating the item!",
      data: null,
    });
  }
};

const createItemBanner = async (req, res) => {
  try {
    const { image, title } = req.body;

    if (!image || !title) {
      return res.status(400).json({
        status: "ERROR",
        message: "Image and title are required!",
        data: null,
      });
    }

    const newItemBanner = new ItemBanner({ image, title });
    await newItemBanner.save();

    return res.status(201).json({
      status: "SUCCESS",
      message: "Item banner created successfully!",
      data: newItemBanner,
    });
  } catch (error) {
    console.error("Error creating item banner:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "An error occurred while creating the item banner!",
      data: null,
    });
  }
};

const updateItem = async (req, res) => {
  try {
    const { id, name, price, description, image, categories, sizes } = req.body;

    if (!id) {
      return res.status(400).json({
        status: "ERROR",
        message: "Item ID is required!",
        data: null,
      });
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (price !== undefined) updateData.price = price;
    if (description !== undefined) updateData.description = description;
    if (image !== undefined) updateData.image = image;
    if (categories !== undefined) {
      if (categories && !Array.isArray(categories)) {
        return res.status(400).json({
          status: "ERROR",
          message: "Categories must be an array!",
          data: null,
        });
      }
      if (categories.length > 0) {
        const validCategories = await Category.find({ _id: { $in: categories } });
        if (validCategories.length !== categories.length) {
          return res.status(400).json({
            status: "ERROR",
            message: "One or more category IDs are invalid!",
            data: null,
          });
        }
      }
      updateData.categories = categories;
    }
    if (sizes !== undefined) {
      if (sizes && !Array.isArray(sizes)) {
        return res.status(400).json({
          status: "ERROR",
          message: "Sizes must be an array!",
          data: null,
        });
      }
      if (sizes) {
        for (const size of sizes) {
          if (!size.name || !size.price || size.price < 0) {
            return res.status(400).json({
              status: "ERROR",
              message: "Each size must have a valid name and price!",
              data: null,
            });
          }
        }
      }
      updateData.sizes = sizes;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        status: "ERROR",
        message: "No fields provided to update!",
        data: null,
      });
    }

    const updatedItem = await itemService.updateItem(id, updateData);
    if (!updatedItem) {
      return res.status(404).json({
        status: "ERROR",
        message: "Item not found!",
        data: null,
      });
    }

    return res.status(200).json({
      status: "SUCCESS",
      message: "Item updated successfully!",
      data: updatedItem,
    });
  } catch (error) {
    console.error("Error updating item:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "An error occurred while updating the item!",
      data: null,
    });
  }
};

const searchItem = async (req, res) => {
  try {
    const otherFields = { ...req.query };

    if (!otherFields || Object.keys(otherFields).length === 0) {
      return res.status(400).json({
        status: "ERROR",
        message: "At least one item field is required!",
        data: null,
      });
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
    if (!items || items.length === 0) {
      return res.status(404).json({
        status: "ERROR",
        message: "No items found matching the criteria!",
        data: null,
      });
    }

    return res.status(200).json({
      status: "SUCCESS",
      message: "Items retrieved successfully!",
      data: items,
    });
  } catch (error) {
    console.error("Error searching items:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "An error occurred while searching items!",
      data: null,
    });
  }
};

const deleteItem = async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({
        status: "ERROR",
        message: "Item ID is required!",
        data: null,
      });
    }

    const item = await itemService.getItemByItemId(id);
    if (typeof item === "string" || !item) {
      return res.status(404).json({
        status: "ERROR",
        message: "Item not found!",
        data: null,
      });
    }

    await Item.findByIdAndDelete(id);

    return res.status(200).json({
      status: "SUCCESS",
      message: "Item deleted successfully!",
      data: null,
    });
  } catch (error) {
    console.error("Error deleting item:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "An error occurred while deleting the item!",
      data: null,
    });
  }
};

const filterItemsByCategory = async (req, res) => {
  try {
    const { categoryId } = req.query;

    if (!categoryId) {
      return res.status(400).json({
        status: "ERROR",
        message: "Category ID is required!",
        data: null,
      });
    }

    const categoryExists = await Category.findById(categoryId);
    if (!categoryExists) {
      return res.status(404).json({
        status: "ERROR",
        message: "Category not found!",
        data: null,
      });
    }

    const items = await Item.find({ categories: categoryId }).populate("categories");

    return res.status(200).json({
      status: "SUCCESS",
      message: "Items filtered by category successfully!",
      data: items,
    });
  } catch (error) {
    console.error("Error filtering items by category:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "An error occurred while filtering items by category!",
      data: null,
    });
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
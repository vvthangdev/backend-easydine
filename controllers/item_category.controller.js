const ItemCategory = require("../models/item_category.model");
const Item = require("../models/item.model");
// const itemCategoryService = require("../services/itemCategory.service");

const getAllItemCategory = async (req, res) => {
  try {
    const itemCategory = await ItemCategory.findAll();
    res.json(itemCategory);
  } catch (error) {
    res.status(500).json({ error: "Error fetching itemCategory" });
  }
};

// const createItemCategory = async (req, res) => {
//   try {
//     const { ...itemCategoryData } = req.body;
//     const newItemCategory = await itemCategoryService.createItemCategory({ ...itemCategoryData });
//     res.status(201).json(newItemCategory);
//   } catch (error) {
//     res.status(500).json({ error: "Error creating itemCategory" });
//   }
// };

// const createItemCategory = async (req, res) => {
//   let { itemId, categories, ...otherFields } = req.body; // Destructure itemId, category và các trường khác

//   // Kiểm tra xem itemId và category có hợp lệ không
//   if (!itemId || !categories || categories.length === 0) {
//     return res.status(400).json({
//       status: "FAILED",
//       message: "itemId and category are required!",
//     });
//   }

//   try {
//     // Tạo mới ItemCategory với các trường đã destructure và spread các trường khác
//     const newItemCategory = categories.map(category => ({
//       itemId: itemId,
//       category: categories.category,
//     }))
//     // const newItemCategory = await ItemCategory.create({
//     //   itemId,
//     //   category,
//     //   ...otherFields, // Spread các trường khác vào
//     // });

//     await ItemCategory.bulkCreate(newItemCategory)

//     // Trả về kết quả
//     return res.status(201).json({
//       status: "SUCCESS",
//       message: "Item category created successfully!",
//       data: newItemCategory,
//     });
//   } catch (error) {
//     console.error(error); // Log lỗi để dễ dàng chẩn đoán
//     return res.status(500).json({
//       status: "FAILED",
//       message: error.message || "Error creating item category",
//     });
//   }
// };

const createItemCategory = async (req, res) => {
  let { itemId, categories, ...otherFields } = req.body; // Destructure itemId, categories và các trường khác

  // Kiểm tra xem itemId và categories có hợp lệ không
  if (!itemId || !categories || categories.length === 0) {
    return res.status(400).json({
      status: "FAILED",
      message: "itemId and categories are required!",
    });
  }

  try {
    // Tạo mảng đối tượng để tạo nhiều ItemCategory
    const newItemCategories = categories.map((category) => ({
      itemId: itemId, // Gán itemId vào từng ItemCategory
      category: category.category, // Gán category từ đối tượng trong mảng
      ...otherFields, // Nếu có thêm các trường khác trong body
    }));

    // Sử dụng bulkCreate để thêm nhiều bản ghi vào bảng ItemCategory
    await ItemCategory.bulkCreate(newItemCategories);

    // Trả về kết quả
    return res.status(201).json({
      status: "SUCCESS",
      message: "Item categories created successfully!",
      data: newItemCategories,
    });
  } catch (error) {
    console.error(error); // Log lỗi để dễ dàng chẩn đoán
    return res.status(500).json({
      status: "FAILED",
      message: error.message || "Error creating item categories",
    });
  }
};

const getItemsByCategory = async (req, res) => {
  const { category } = req.body; // Lấy category từ body của yêu cầu

  // Kiểm tra xem category có được cung cấp không
  if (!category) {
    return res.status(400).json({
      status: "FAILED",
      message: "Category is required!",
    });
  }

  try {
    // Tìm các itemId có liên kết với category cụ thể trong ItemCategory
    const itemCategories = await ItemCategory.findAll({
      where: { category },
      attributes: ["itemId"], // Chỉ lấy itemId từ ItemCategory
    });

    if (!itemCategories || itemCategories.length === 0) {
      return res.status(404).json({
        status: "FAILED",
        message: `No items found for category ${category}`,
      });
    }

    // Tạo danh sách itemId từ kết quả ItemCategory
    const itemIds = itemCategories.map((itemCategory) => itemCategory.itemId);

    // Tìm các Item tương ứng với itemId đã tìm thấy
    const items = await Item.findAll({
      where: { id: itemIds }, // Tìm theo itemId
    });

    // Trả về kết quả
    return res.status(200).json({
      status: "SUCCESS",
      message: `Items found for category ${category}`,
      data: items,
    });
  } catch (error) {
    console.error(error); // Log lỗi để dễ dàng chẩn đoán
    return res.status(500).json({
      status: "FAILED",
      message: error.message || "Error fetching items by category",
    });
  }
};

// const updateItemCategory = async (req, res) => {
//   try {
//     const { id, ...otherFields } = req.body; // Adjust as needed to accept relevant fields
//     if (!id) {
//       return res.status(400).send("ItemCategory id required.");
//     }
//     if (!otherFields || Object.keys(otherFields).length === 0) {
//       return res.status(400).send("No fields to update.");
//     }
//     // Update the user information in the database
//     const updatedItemCategory = await itemCategoryService.updateItemCategory(id, {
//       ...otherFields, // Spread other fields if there are additional updates
//     });

//     if (!updatedItemCategory) {
//       return res.status(404).send("ItemCategory not found!");
//     }
//     res.json({
//       status: "SUCCESS",
//       message: "ItemCategory updated successfully!",
//       ItemCategory: updatedItemCategory,
//     });
//   } catch (error) {
//     res.status(500).json({ error: "Error updating itemCategory" });
//   }
// };

// const searchItemCategory = async (req, res) => {
// //   console.log(req.body);
//   try {
//     let { ...otherFields } = req.body; // Adjust as needed to accept relevant fields
//     // console.log(otherFields);

//     if (!otherFields || Object.keys(otherFields).length === 0) {
//       return res.status(400).send("ItemCategory info required.");
//     }

//     const itemCategory = await itemCategoryService.searchItemCategory(...otherFields);

//     // Update the user information in the database
//     // const updatedUser = await userService.updateUser(req.user.username, {
//     //   ...otherFields, // Spread other fields if there are additional updates
//     // });

//     // if (!updatedUser) {
//     //   return res.status(404).send("User not found!");
//     // }
//     console.log(itemCategory);
//     res.status(200).json({ itemCategory: itemCategory });
//   } catch (error) {
//     res.status(500).json({ error: "Error fetching itemCategory" });
//   }
// };

// const deleteItemCategory = async (req, res) => {
//   try {
//     console.log(req.body.id);
//     const itemCategory = await itemCategoryService.getItemCategoryByItemCategoryId(req.body.id);
//     if (itemCategory) {
//       await itemCategory.destroy();
//       res.json({ message: "ItemCategory deleted" });
//     } else {
//       res.status(404).json({ error: "ItemCategory not found" });
//     }
//   } catch (error) {
//     res.status(500).json({ error: "Error deleting itemCategory" });
//   }
// };

module.exports = {
  getAllItemCategory,
  createItemCategory,
  getItemsByCategory,
  //   updateItemCategory,
  //   searchItemCategory,
  //   deleteItemCategory,
};

const express = require("express");
const itemController = require("../controllers/item.controller.js");
const authMiddware = require("../middlewares/auth.middleware.js");

const router = express.Router();

router.get("/", itemController.getAllItems);
router.get("/item-banner", itemController.getItemBanner);
router.post("/create-itembanner", itemController.createItemBanner);

// Route mới: Tạo danh mục
router.post("/create-category", itemController.createCategory);
router.get("/categories", itemController.getAllCategories);
// Route mới: Xóa danh mục
router.delete("/delete-category", itemController.deleteCategory);

// Bảo vệ các route dưới đây (tùy chọn)
// router.use(authMiddware.authenticateToken);
// router.use(authMiddware.adminRoleAuth);

router.post("/create-item", itemController.createItem); // Đã có sẵn, sẽ cập nhật
router.patch("/update-item", itemController.updateItem); // Đã có sẵn, sẽ cập nhật
router.get("/search-item", itemController.searchItem);
router.delete("/delete-item", itemController.deleteItem);

// Route mới: Lọc món ăn theo danh mục
router.get("/filter-by-category", itemController.filterItemsByCategory);

module.exports = router;
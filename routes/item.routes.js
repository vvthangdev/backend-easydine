const express = require("express");
const itemController = require("../controllers/item.controller.js");
const authMiddware = require("../middlewares/auth.middleware.js");

const router = express.Router();

router.get("/", itemController.getAllItems);
router.get("/item-banner", itemController.getItemBanner);
router.post("/create-itembanner", itemController.createItemBanner);

// Nếu muốn bảo vệ các route dưới đây, uncomment và thêm middleware
// router.use(authMiddware.authenticateToken);
// router.use(authMiddware.adminRoleAuth);

router.post("/create-item", itemController.createItem);
router.patch("/update-item", itemController.updateItem);
router.get("/search-item", itemController.searchItem);
router.delete("/delete-item", itemController.deleteItem);

module.exports = router;
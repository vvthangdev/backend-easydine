const express = require("express");
const userMiddleware = require("../middlewares/user.middleware.js");
const itemController = require("../controllers/item.controller.js");
// const userUtil = require("../utils/user.util.js");
const authMiddware = require("../middlewares/auth.middleware.js");

const router = express.Router();

router.get("/", itemController.getAllItems);

router.get("/item-banner", itemController.getItemBanner);
router.post("/create-itembanner", itemController.createItemBanner);

// router.use(authMiddware.authenticateToken);
// router.use(authMiddware.adminRoleAuth);

router.post("/create-item", itemController.createItem);

router.patch("/update-item", itemController.updateItem);

router.get("/search-item", itemController.searchItem);

router.delete("/delete-item", itemController.deleteItem);

module.exports = router;

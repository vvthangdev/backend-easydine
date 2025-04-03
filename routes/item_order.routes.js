const express = require("express");
const userMiddleware = require("../middlewares/user.middleware.js");
const itemOrdController = require("../controllers/item_order.controller.js");
const authMiddleware = require("../middlewares/auth.middleware.js");

const router = express.Router();

router.get("/", itemOrdController.getAllItemOrds);

// router.use(authMiddleware.authenticateToken);
// router.use(authMiddleware.adminRoleAuth);

router.post("/create-itemOrd", itemOrdController.createItemOrd);

router.patch("/update-itemOrd", itemOrdController.updateItemOrd);

router.delete("/delete-itemOrd", itemOrdController.deleteItemOrd);

module.exports = router;
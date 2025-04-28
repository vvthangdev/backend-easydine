const express = require("express");
const orderController = require("../controllers/order.controller.js");
const authMiddleware = require("../middlewares/auth.middleware.js");

const router = express.Router();

router.use(authMiddleware.authenticateToken);

router.get("/", orderController.getAllOrders);
router.get("/all-order-info", orderController.getAllOrdersInfo);
router.patch("/update-order", orderController.updateOrder);
router.get("/my-orders", orderController.getUserOrders);
router.delete("/delete-order/:id", authMiddleware.adminRoleAuth, orderController.deleteOrder);
router.get("/order-info", orderController.getOrderInfo);
router.post("/create-order", orderController.createOrder);
router.get("/available-tables", orderController.getAvailableTables);
router.get("/search-by-customer", authMiddleware.adminRoleAuth, orderController.searchOrdersByCustomerId);

// Route mới
router.post("/confirm-order", authMiddleware.adminRoleAuth, orderController.confirmOrder);

router.post("/split-order", authMiddleware.adminRoleAuth, orderController.splitOrder);

module.exports = router;
const express = require("express");
const orderController = require("../controllers/order.controller.js");
const authMiddware = require("../middlewares/auth.middleware.js");

const router = express.Router();

router.use(authMiddware.authenticateToken);

router.get("/", authMiddware.adminRoleAuth, orderController.getAllOrders);
router.get("/all-order-info", authMiddware.adminRoleAuth, orderController.getAllOrdersInfo);
router.patch("/update-order-status", orderController.updateOrder);
router.get("/get-all-user-orders", orderController.getAllOrdersOfCustomer);
router.delete("/delete-order/:id", authMiddware.adminRoleAuth, orderController.deleteOrder);
router.get("/order-info", orderController.getOrderInfo);
router.post("/create-order", orderController.createOrder);

module.exports = router;
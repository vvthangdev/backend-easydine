const express = require("express");
const orderController = require("../controllers/order.controller.js");
const authMiddleware = require("../middlewares/auth.middleware.js");

const router = express.Router();

router.use(authMiddleware.authenticateToken);

router.get("/",authMiddleware.authenticateToken, orderController.getAllOrders);
router.get("/all-order-info", orderController.getAllOrdersInfo);
router.patch("/update-order", orderController.updateOrder);
router.get("/my-orders", orderController.getUserOrders);
router.delete("/delete-order/:id", authMiddleware.adminRoleAuth, orderController.deleteOrder);
router.get("/order-info", orderController.getOrderInfo);
router.post("/create-order", orderController.createOrder);
router.get("/search-by-customer", authMiddleware.adminRoleAuth, orderController.searchOrdersByCustomerId);
router.post("/split-order", authMiddleware.adminRoleAuth, orderController.splitOrder);

router.post("/merge-order", authMiddleware.adminRoleAuth, orderController.mergeOrder);
router.post("/create-payment", authMiddleware.authenticateToken, orderController.createPayment);
router.get("/payment-return", orderController.handlePaymentReturn);
router.get("/payment-ipn", orderController.handlePaymentIPN);
router.post("/add-items-to-order", authMiddleware.authenticateToken, orderController.addItemsToOrder);
router.post("/cancel-items", authMiddleware.authenticateToken, orderController.cancelItems);

module.exports = router;
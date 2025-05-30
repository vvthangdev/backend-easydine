const express = require("express");
const orderController = require("../controllers/order.controller.js");
const authMiddleware = require("../middlewares/auth.middleware.js");

const router = express.Router();

router.get("/", authMiddleware.authenticateToken, orderController.getAllOrders);

router.post(
  "/create-order",
  authMiddleware.authenticateToken,
  orderController.createOrder
);

router.post(
  "/create-table-order",
  orderController.createTableOrder
);
router.get(
  "/all-order-info",
  authMiddleware.authenticateToken,
  orderController.getAllOrdersInfo
);
router.patch(
  "/update-order",
  authMiddleware.authenticateToken,
  orderController.updateOrder
);
router.get(
  "/my-orders",
  authMiddleware.authenticateToken,
  orderController.getUserOrders
);
router.delete(
  "/delete-order/:id",
  authMiddleware.authenticateToken,
  authMiddleware.adminRoleAuth,
  orderController.deleteOrder
);
router.get(
  "/order-info",
  authMiddleware.authenticateToken,
  orderController.getOrderInfo
);

router.get(
  "/search-by-customer",
  authMiddleware.authenticateToken,
  authMiddleware.adminRoleAuth,
  orderController.searchOrdersByCustomerId
);
router.post(
  "/split-order",
  authMiddleware.authenticateToken,
  authMiddleware.adminRoleAuth,
  orderController.splitOrder
);

router.post(
  "/merge-order",
  authMiddleware.authenticateToken,
  authMiddleware.adminRoleAuth,
  orderController.mergeOrder
);
router.post(
  "/create-payment",
  authMiddleware.authenticateToken,
  orderController.createPayment
);
router.get("/payment-return", orderController.handlePaymentReturn);
router.get("/payment-ipn", orderController.handlePaymentIPN);
router.post(
  "/add-items-to-order",
  authMiddleware.authenticateToken,
  authMiddleware.authenticateToken,
  orderController.addItemsToOrder
);
router.post(
  "/cancel-items",
  authMiddleware.authenticateToken,
  authMiddleware.authenticateToken,
  orderController.cancelItems
);

router.get("/test01", orderController.testNewOrder)

router.get("/test02", orderController.testNewOrder2)

module.exports = router;

const express = require("express");
const userMiddleware = require("../middlewares/user.middleware.js");
const orderController = require("../controllers/order.controller.js");
const authMiddware = require("../middlewares/auth.middleware.js");
const { route } = require("./user.routes.js");

const router = express.Router();

router.use(authMiddware.authenticateToken);

router.get("/", authMiddware.adminRoleAuth, orderController.getAllOrders);
router.get(
  "/all-order-info",
  authMiddware.adminRoleAuth,
  orderController.getAllOrdersInfo
);

router.patch("/update-order-status", orderController.updateOrder);

router.get(
  "/get-all-user-orders",
  authMiddware.authenticateToken,
  orderController.getAllOrdersOfCustomer
);

router.delete(
  "/delete-order/:id",
  authMiddware.adminRoleAuth,
  orderController.deleteOrder
);

router.get("/order-info", orderController.getOrderInfo);

// router.use(authMiddware.notAdminRoleAuth);

router.post(
  "/create-order",
  authMiddware.notAdminRoleAuth,
  orderController.createOrder
);

module.exports = router;

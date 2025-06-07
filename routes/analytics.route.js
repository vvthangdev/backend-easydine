const express = require("express");
const analyticsController = require("../controllers/analytics.controller.js");
const authMiddleware = require("../middlewares/auth.middleware.js");

const router = express.Router();

// Nhóm API phân tích đơn hàng
router.get(
  "/orders/status",
  authMiddleware.authenticateToken,
  authMiddleware.adminRoleAuth,
  analyticsController.getOrderStatusDistribution
);

router.get(
  "/orders/revenue",
  authMiddleware.authenticateToken,
  authMiddleware.adminRoleAuth,
  analyticsController.getRevenueTrend
);

router.get(
  "/orders/payment-methods",
  authMiddleware.authenticateToken,
  authMiddleware.adminRoleAuth,
  analyticsController.getPaymentMethodDistribution
);

router.get(
  "/orders/people-amount",
  authMiddleware.authenticateToken,
  authMiddleware.adminRoleAuth,
  analyticsController.getPeopleVsAmount
);

router.get(
  "/orders/cancel-reasons",
  authMiddleware.authenticateToken,
  authMiddleware.adminRoleAuth,
  analyticsController.getCancelReasonDistribution
);

// Nhóm API phân tích món ăn
router.get(
  "/items/category-sales",
  authMiddleware.authenticateToken,
  authMiddleware.adminRoleAuth,
  analyticsController.getItemSalesByCategory
);

router.get(
  "/items/category-distribution",
  authMiddleware.authenticateToken,
  authMiddleware.adminRoleAuth,
  analyticsController.getItemCategoryDistribution
);

module.exports = router;
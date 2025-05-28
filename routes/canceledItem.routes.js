const express = require("express");
const canceledItemOrderController = require("../controllers/canceledItemOrder.controller");
const authMiddleware = require("../middlewares/auth.middleware");

const router = express.Router();

// Test middleware type - should now return "function"
// console.log(`vvt check: ${typeof authMiddleware.restrictTo(["ADMIN", "STAFF"])}`);
// console.log(`requireStaff type: ${typeof authMiddleware.requireStaff}`);
// console.log(`requireAdmin type: ${typeof authMiddleware.requireAdmin}`);

// Create a new canceled item order (ADMIN or STAFF)
router.post(
  "/",
  authMiddleware.authenticateToken,
  authMiddleware.requireStaff, // Thay vì restrictTo(["ADMIN", "STAFF"])
  canceledItemOrderController.createCanceledItemOrder
);

// Get all canceled item orders (ADMIN only)
router.get(
  "/",
  authMiddleware.authenticateToken,
  authMiddleware.requireAdmin, // Thay vì adminRoleAuth
  canceledItemOrderController.getAllCanceledItemOrders
);

// Get a canceled item order by ID (ADMIN or STAFF)
router.get(
  "/:id",
  authMiddleware.authenticateToken,
  authMiddleware.requireStaff, // Thay vì restrictTo(["ADMIN", "STAFF"])
  canceledItemOrderController.getCanceledItemOrderById
);

// Update a canceled item order (ADMIN only)
router.patch(
  "/:id",
  authMiddleware.authenticateToken,
  authMiddleware.requireAdmin, // Thay vì adminRoleAuth
  canceledItemOrderController.updateCanceledItemOrder
);

// Delete a canceled item order (ADMIN only)
router.delete(
  "/:id",
  authMiddleware.authenticateToken,
  authMiddleware.requireAdmin, // Thay vì adminRoleAuth
  canceledItemOrderController.deleteCanceledItemOrder
);

module.exports = router;

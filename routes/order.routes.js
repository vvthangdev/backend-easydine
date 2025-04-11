const express = require("express");
const orderController = require("../controllers/order.controller.js");
const authMiddware = require("../middlewares/auth.middleware.js");

const router = express.Router();

router.use(authMiddware.authenticateToken); // Xác thực token cho tất cả route

router.get("/", orderController.getAllOrders); // Không cần adminRoleAuth
router.get("/all-order-info", orderController.getAllOrdersInfo); // Không cần adminRoleAuth
router.patch("/update-order", orderController.updateOrder);
router.get("/my-orders", orderController.getUserOrders);
router.delete("/delete-order/:id", authMiddware.adminRoleAuth, orderController.deleteOrder); // Giữ adminRoleAuth
router.get("/order-info", orderController.getOrderInfo); // Không cần adminRoleAuth
router.post("/create-order", orderController.createOrder);

// Route mới: Lấy danh sách bàn khả dụng
router.get("/available-tables", orderController.getAvailableTables);

// Route mới cho ADMIN: Tìm kiếm đơn hàng theo customer_id
router.get("/search-by-customer", orderController.searchOrdersByCustomerId);

module.exports = router;
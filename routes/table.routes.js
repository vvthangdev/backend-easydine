const express = require("express");
const tableController = require("../controllers/table.controller.js");
const authMiddware = require("../middlewares/auth.middleware.js");

const router = express.Router();

router.get("/", tableController.getAllTables);

// Nếu muốn bảo vệ các route dưới đây, uncomment và thêm middleware
// router.use(authMiddware.authenticateToken);
// router.use(authMiddware.adminRoleAuth);

router.post("/create-table", tableController.createTable);
router.patch("/update-table", tableController.updateTable);
router.delete("/delete-table", tableController.deleteTable);
router.get("/tables-status", tableController.getAllTablesStatus);

router.post("/release-table", tableController.releaseTable); // Route mới

router.get("/available-tables", tableController.getAvailableTables);

module.exports = router;
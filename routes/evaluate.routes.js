const express = require("express");
const authMiddleware = require("../middlewares/auth.middleware");
const router = express.Router();

router.post(
    '/:orderId',
    authMiddleware.authenticateToken,
    
);

router.get(
    '/:orderId',
    authMiddleware.authenticateToken,
);
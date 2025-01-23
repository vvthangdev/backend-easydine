
const express = require("express");
const authMiddelware = require("../middlewares/auth.middleware");
const router = express.Router();
const contactController = require("../controllers/contact.controller.js");

router.post('/create', authMiddelware.authenticateToken, contactController.createContact);

router.get('/getAll', authMiddelware.authenticateToken, authMiddelware.adminRoleAuth, contactController.getAllContacts);

module.exports = router;
const voucherService = require("../services/voucher.service");

const getAllVouchers = async (req, res) => {
  try {
    const vouchers = await voucherService.getAllVouchers();
    res.status(200).json(vouchers);
  } catch (error) {
    res
      .status(500)
      .json({ error: error.message || "Error fetching all vouchers" });
  }
};

const createVoucher = async (req, res) => {
  try {
    const voucher = await voucherService.createVoucher(req.body);
    res.status(201).json(voucher);
  } catch (error) {
    res.status(500).json({ error: error.message || "Error creating voucher" });
  }
};

const getVoucher = async (req, res) => {
  try {
    const { code } = req.query;
    const voucher = await voucherService.getVoucherByCode(code);
    res.status(200).json(voucher);
  } catch (error) {
    res.status(400).json({ error: error.message || "Error fetching voucher" });
  }
};

const getVoucherById = async (req, res) => {
  try {
    const { id } = req.params;
    const voucher = await voucherService.getVoucherById(id);
    res.status(200).json(voucher);
  } catch (error) {
    res.status(400).json({ error: error.message || "Error fetching voucher" });
  }
};

const updateVoucher = async (req, res) => {
  try {
    const { id } = req.params;
    const voucher = await voucherService.updateVoucher(id, req.body);
    res.status(200).json(voucher);
  } catch (error) {
    res.status(400).json({ error: error.message || "Error updating voucher" });
  }
};

const deleteVoucher = async (req, res) => {
  try {
    const { id } = req.params;
    const voucher = await voucherService.deleteVoucher(id);
    res.status(200).json({ message: "Voucher deleted successfully", voucher });
  } catch (error) {
    res.status(400).json({ error: error.message || "Error deleting voucher" });
  }
};

const addUsersToVoucher = async (req, res) => {
  try {
    const { id } = req.params;
    const { userIds } = req.body; // Expecting an array of user IDs
    if (!userIds || !Array.isArray(userIds)) {
      return res.status(400).json({ error: "userIds must be an array" });
    }
    const updatedVoucher = await voucherService.addUsersToVoucher(id, userIds);
    res.status(200).json(updatedVoucher);
  } catch (error) {
    res
      .status(400)
      .json({ error: error.message || "Error adding users to voucher" });
  }
};

const removeUsersFromVoucher = async (req, res) => {
  try {
    const { id } = req.params;
    const { userIds } = req.body; // Expecting an array of user IDs
    if (!userIds || !Array.isArray(userIds)) {
      return res.status(400).json({ error: "userIds must be an array" });
    }
    const updatedVoucher = await voucherService.removeUsersFromVoucher(
      id,
      userIds
    );
    res.status(200).json(updatedVoucher);
  } catch (error) {
    res
      .status(400)
      .json({ error: error.message || "Error removing users from voucher" });
  }
};

module.exports = {
  getAllVouchers,
  createVoucher,
  getVoucher,
  getVoucherById,
  updateVoucher,
  deleteVoucher,
  addUsersToVoucher,
  removeUsersFromVoucher,
};

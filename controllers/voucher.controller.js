const voucherService = require("../services/voucher.service");

const getAllVouchers = async (req, res) => {
  try {
    const vouchers = await voucherService.getAllVouchers();

    return res.status(200).json({
      status: "SUCCESS",
      message: "Lấy danh sách voucher thành công!",
      data: vouchers,
    });
  } catch (error) {
    console.error("Lỗi khi lấy danh sách voucher:", error);
    return res.status(500).json({
      status: "ERROR",
      message: error.message || "Đã xảy ra lỗi khi lấy danh sách voucher!",
      data: null,
    });
  }
};

const createVoucher = async (req, res) => {
  try {
    const { ...voucherData } = req.body;

    if (!voucherData || Object.keys(voucherData).length === 0) {
      return res.status(400).json({
        status: "ERROR",
        message: "Dữ liệu voucher là bắt buộc!",
        data: null,
      });
    }

    const voucher = await voucherService.createVoucher(voucherData);

    return res.status(201).json({
      status: "SUCCESS",
      message: "Tạo voucher thành công!",
      data: voucher,
    });
  } catch (error) {
    console.error("Lỗi khi tạo voucher:", error);
    return res.status(500).json({
      status: "ERROR",
      message: error.message || "Đã xảy ra lỗi khi tạo voucher!",
      data: null,
    });
  }
};

const getVoucher = async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({
        status: "ERROR",
        message: "Mã voucher là bắt buộc!",
        data: null,
      });
    }

    const voucher = await voucherService.getVoucherByCode(code);
    if (!voucher) {
      return res.status(404).json({
        status: "ERROR",
        message: "Không tìm thấy voucher!",
        data: null,
      });
    }

    return res.status(200).json({
      status: "SUCCESS",
      message: "Lấy thông tin voucher thành công!",
      data: voucher,
    });
  } catch (error) {
    console.error("Lỗi khi lấy voucher:", error);
    return res.status(400).json({
      status: "ERROR",
      message: error.message || "Đã xảy ra lỗi khi lấy voucher!",
      data: null,
    });
  }
};

const getVoucherById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        status: "ERROR",
        message: "ID voucher là bắt buộc!",
        data: null,
      });
    }

    const voucher = await voucherService.getVoucherById(id);
    if (!voucher) {
      return res.status(404).json({
        status: "ERROR",
        message: "Không tìm thấy voucher!",
        data: null,
      });
    }

    return res.status(200).json({
      status: "SUCCESS",
      message: "Lấy thông tin voucher thành công!",
      data: voucher,
    });
  } catch (error) {
    console.error("Lỗi khi lấy voucher theo ID:", error);
    return res.status(400).json({
      status: "ERROR",
      message: error.message || "Đã xảy ra lỗi khi lấy voucher!",
      data: null,
    });
  }
};

const updateVoucher = async (req, res) => {
  try {
    const { id } = req.params;
    const { ...updateData } = req.body;

    if (!id) {
      return res.status(400).json({
        status: "ERROR",
        message: "ID voucher là bắt buộc!",
        data: null,
      });
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      return res.status(400).json({
        status: "ERROR",
        message: "Không có trường nào để cập nhật!",
        data: null,
      });
    }

    const voucher = await voucherService.updateVoucher(id, updateData);
    if (!voucher) {
      return res.status(404).json({
        status: "ERROR",
        message: "Không tìm thấy voucher!",
        data: null,
      });
    }

    return res.status(200).json({
      status: "SUCCESS",
      message: "Cập nhật voucher thành công!",
      data: voucher,
    });
  } catch (error) {
    console.error("Lỗi khi cập nhật voucher:", error);
    return res.status(400).json({
      status: "ERROR",
      message: error.message || "Đã xảy ra lỗi khi cập nhật voucher!",
      data: null,
    });
  }
};

const deleteVoucher = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        status: "ERROR",
        message: "ID voucher là bắt buộc!",
        data: null,
      });
    }

    const voucher = await voucherService.deleteVoucher(id);
    if (!voucher) {
      return res.status(404).json({
        status: "ERROR",
        message: "Không tìm thấy voucher!",
        data: null,
      });
    }

    return res.status(200).json({
      status: "SUCCESS",
      message: "Xóa voucher thành công!",
      data: voucher,
    });
  } catch (error) {
    console.error("Lỗi khi xóa voucher:", error);
    return res.status(400).json({
      status: "ERROR",
      message: error.message || "Đã xảy ra lỗi khi xóa voucher!",
      data: null,
    });
  }
};

const addUsersToVoucher = async (req, res) => {
  try {
    const { id } = req.params;
    const { userIds } = req.body;

    if (!id) {
      return res.status(400).json({
        status: "ERROR",
        message: "ID voucher là bắt buộc!",
        data: null,
      });
    }

    if (!userIds || !Array.isArray(userIds)) {
      return res.status(400).json({
        status: "ERROR",
        message: "userIds phải là một mảng!",
        data: null,
      });
    }

    const updatedVoucher = await voucherService.addUsersToVoucher(id, userIds);
    if (!updatedVoucher) {
      return res.status(404).json({
        status: "ERROR",
        message: "Không tìm thấy voucher!",
        data: null,
      });
    }

    return res.status(200).json({
      status: "SUCCESS",
      message: "Thêm người dùng vào voucher thành công!",
      data: updatedVoucher,
    });
  } catch (error) {
    console.error("Lỗi khi thêm người dùng vào voucher:", error);
    return res.status(400).json({
      status: "ERROR",
      message: error.message || "Đã xảy ra lỗi khi thêm người dùng vào voucher!",
      data: null,
    });
  }
};

const removeUsersFromVoucher = async (req, res) => {
  try {
    const { id } = req.params;
    const { userIds } = req.body;

    if (!id) {
      return res.status(400).json({
        status: "ERROR",
        message: "ID voucher là bắt buộc!",
        data: null,
      });
    }

    if (!userIds || !Array.isArray(userIds)) {
      return res.status(400).json({
        status: "ERROR",
        message: "userIds phải là một mảng!",
        data: null,
      });
    }

    const updatedVoucher = await voucherService.removeUsersFromVoucher(id, userIds);
    if (!updatedVoucher) {
      return res.status(404).json({
        status: "ERROR",
        message: "Không tìm thấy voucher!",
        data: null,
      });
    }

    return res.status(200).json({
      status: "SUCCESS",
      message: "Xóa người dùng khỏi voucher thành công!",
      data: updatedVoucher,
    });
  } catch (error) {
    console.error("Lỗi khi xóa người dùng khỏi voucher:", error);
    return res.status(400).json({
      status: "ERROR",
      message: error.message || "Đã xảy ra lỗi khi xóa người dùng khỏi voucher!",
      data: null,
    });
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
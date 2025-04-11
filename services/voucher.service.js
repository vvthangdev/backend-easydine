const Voucher = require("../models/voucher.model");

async function getAllVouchers() {
  try {
    const vouchers = await Voucher.find();
    return vouchers;
  } catch (error) {
    console.error("Error fetching all vouchers:", error);
    throw new Error("Error fetching all vouchers");
  }
}

async function createVoucher(voucherData) {
  try {
    const newVoucher = new Voucher(voucherData);
    await newVoucher.save();
    return newVoucher;
  } catch (error) {
    console.error("Error creating voucher:", error);
    throw new Error("Error creating voucher");
  }
}

async function getVoucherByCode(code) {
  try {
    const voucher = await Voucher.findOne({ code });
    if (!voucher) throw new Error("Voucher không tồn tại");
    return voucher;
  } catch (error) {
    console.error("Error fetching voucher:", error);
    throw error;
  }
}

async function getVoucherById(id) {
  try {
    const voucher = await Voucher.findById(id);
    if (!voucher) throw new Error("Voucher không tồn tại");
    return voucher;
  } catch (error) {
    console.error("Error fetching voucher by ID:", error);
    throw error;
  }
}

async function updateVoucher(id, data) {
  try {
    const voucher = await Voucher.findByIdAndUpdate(id, data, { new: true });
    if (!voucher) throw new Error("Voucher không tồn tại");
    return voucher;
  } catch (error) {
    console.error("Error updating voucher:", error);
    throw new Error("Error updating voucher");
  }
}

async function deleteVoucher(id) {
  try {
    const voucher = await Voucher.findByIdAndDelete(id);
    if (!voucher) throw new Error("Voucher không tồn tại");
    return voucher;
  } catch (error) {
    console.error("Error deleting voucher:", error);
    throw new Error("Error deleting voucher");
  }
}

async function addUsersToVoucher(voucherId, userIds) {
  try {
    const voucher = await Voucher.findById(voucherId);
    if (!voucher) throw new Error("Voucher không tồn tại");

    const updatedUsers = [...new Set([...voucher.applicableUsers, ...userIds])]; // Loại bỏ trùng lặp
    const updatedVoucher = await Voucher.findByIdAndUpdate(
      voucherId,
      { applicableUsers: updatedUsers },
      { new: true }
    );
    return updatedVoucher;
  } catch (error) {
    console.error("Error adding users to voucher:", error);
    throw new Error("Error adding users to voucher");
  }
}

async function removeUsersFromVoucher(voucherId, userIds) {
  try {
    const voucher = await Voucher.findById(voucherId);
    if (!voucher) throw new Error("Voucher không tồn tại");

    const updatedUsers = voucher.applicableUsers.filter(
      (userId) => !userIds.some((id) => id.equals(userId))
    );
    const updatedVoucher = await Voucher.findByIdAndUpdate(
      voucherId,
      { applicableUsers: updatedUsers },
      { new: true }
    );
    return updatedVoucher;
  } catch (error) {
    console.error("Error removing users from voucher:", error);
    throw new Error("Error removing users from voucher");
  }
}

async function applyVoucher(orderId, voucherCode, customerId, totalAmount) {
  try {
    const voucher = await Voucher.findOne({
      code: voucherCode,
      isActive: true,
    });
    if (!voucher) throw new Error("Voucher không tồn tại hoặc không hoạt động");

    const now = new Date();
    if (now < voucher.startDate || now > voucher.endDate) {
      throw new Error("Voucher đã hết hạn hoặc chưa bắt đầu");
    }

    if (voucher.usageLimit && voucher.usedCount >= voucher.usageLimit) {
      throw new Error("Voucher đã hết lượt sử dụng");
    }

    if (
      voucher.applicableUsers.length > 0 &&
      !voucher.applicableUsers.some((id) => id.equals(customerId))
    ) {
      throw new Error("Voucher không áp dụng cho bạn");
    }

    if (totalAmount < voucher.minOrderValue) {
      throw new Error(
        `Đơn hàng phải đạt tối thiểu ${voucher.minOrderValue} để áp dụng voucher`
      );
    }

    let discountAmount = 0;
    if (voucher.discountType === "percentage") {
      discountAmount = (voucher.discount / 100) * totalAmount;
    } else {
      discountAmount = voucher.discount;
    }

    await Voucher.findByIdAndUpdate(voucher._id, { $inc: { usedCount: 1 } });

    return {
      voucherId: voucher._id,
      discountAmount,
      originalAmount: totalAmount,
      finalAmount: totalAmount - discountAmount,
    };
  } catch (error) {
    console.error("Error applying voucher:", error);
    throw error;
  }
}

module.exports = {
  getAllVouchers,
  createVoucher,
  getVoucherByCode,
  getVoucherById,
  updateVoucher,
  deleteVoucher,
  addUsersToVoucher,
  removeUsersFromVoucher,
  applyVoucher,
};

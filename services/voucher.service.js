const mongoose = require("mongoose");
const Voucher = require("../models/voucher.model");
const OrderDetail = require("../models/order_detail.model");
const ItemOrder = require("../models/item_order.model");
const Item = require("../models/item.model");

async function getAllVouchers() {
  try {
    const vouchers = await Voucher.find();
    return vouchers;
  } catch (error) {
    console.error("Error fetching all vouchers:", error);
    throw new Error("Lỗi khi lấy danh sách voucher");
  }
}

async function createVoucher(voucherData) {
  try {
    // Kiểm tra và làm sạch applicableUsers trong voucherData
    if (
      voucherData.applicableUsers &&
      Array.isArray(voucherData.applicableUsers)
    ) {
      const validUserIds = voucherData.applicableUsers
        .filter((id) => mongoose.isValidObjectId(id))
        .map((id) => new mongoose.Types.ObjectId(id));
      voucherData.applicableUsers = [
        ...new Set(validUserIds.map((id) => id.toString())),
      ].map((id) => new mongoose.Types.ObjectId(id));
    }
    const newVoucher = new Voucher(voucherData);
    await newVoucher.save();
    return newVoucher;
  } catch (error) {
    console.error("Error creating voucher:", error);
    throw new Error("Lỗi khi tạo voucher");
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
    // Kiểm tra và làm sạch applicableUsers trong data
    if (data.applicableUsers && Array.isArray(data.applicableUsers)) {
      const validUserIds = data.applicableUsers
        .filter((id) => mongoose.isValidObjectId(id))
        .map((id) => new mongoose.Types.ObjectId(id));
      // Loại bỏ trùng lặp bằng Set
      data.applicableUsers = [
        ...new Set(validUserIds.map((id) => id.toString())),
      ].map((id) => new mongoose.Types.ObjectId(id));
    }
    const voucher = await Voucher.findByIdAndUpdate(id, data, { new: true });
    if (!voucher) throw new Error("Voucher không tồn tại");
    return voucher;
  } catch (error) {
    console.error("Error updating voucher:", error);
    throw new Error(error.message || "Lỗi khi cập nhật voucher");
  }
}

async function deleteVoucher(id) {
  try {
    const voucher = await Voucher.findByIdAndDelete(id);
    if (!voucher) throw new Error("Voucher không tồn tại");
    return voucher;
  } catch (error) {
    console.error("Error deleting voucher:", error);
    throw new Error("Lỗi khi xóa voucher");
  }
}

async function addUsersToVoucher(voucherId, userIds) {
  try {
    // Kiểm tra voucherId hợp lệ
    if (!mongoose.isValidObjectId(voucherId)) {
      throw new Error("ID voucher không hợp lệ");
    }

    // Kiểm tra và chuyển đổi userIds thành ObjectId
    const validUserIds = userIds
      .filter((id) => mongoose.isValidObjectId(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    if (validUserIds.length === 0) {
      throw new Error("Không có ID người dùng hợp lệ để thêm");
    }

    const voucher = await Voucher.findById(voucherId);
    if (!voucher) throw new Error("Voucher không tồn tại");

    // Loại bỏ trùng lặp bằng Set
    const updatedUsers = [
      ...new Set([
        ...voucher.applicableUsers.map((id) => id.toString()),
        ...validUserIds.map((id) => id.toString()),
      ]),
    ].map((id) => new mongoose.Types.ObjectId(id));

    const updatedVoucher = await Voucher.findByIdAndUpdate(
      voucherId,
      { applicableUsers: updatedUsers },
      { new: true }
    );
    return updatedVoucher;
  } catch (error) {
    console.error("Error adding users to voucher:", error);
    throw new Error(error.message || "Lỗi khi thêm người dùng vào voucher");
  }
}

async function removeUsersFromVoucher(voucherId, userIds) {
  try {
    // Kiểm tra voucherId hợp lệ
    if (!mongoose.isValidObjectId(voucherId)) {
      throw new Error("ID voucher không hợp lệ");
    }

    // Kiểm tra và chuyển đổi userIds thành ObjectId
    const validUserIds = userIds
      .filter((id) => mongoose.isValidObjectId(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    if (validUserIds.length === 0) {
      throw new Error("Không có ID người dùng hợp lệ để xóa");
    }

    const voucher = await Voucher.findById(voucherId);
    if (!voucher) throw new Error("Voucher không tồn tại");

    const updatedUsers = voucher.applicableUsers.filter(
      (userId) => !validUserIds.some((id) => id.equals(userId))
    );

    const updatedVoucher = await Voucher.findByIdAndUpdate(
      voucherId,
      { applicableUsers: updatedUsers },
      { new: true }
    );
    return updatedVoucher;
  } catch (error) {
    console.error("Error removing users from voucher:", error);
    throw new Error(error.message || "Lỗi khi xóa người dùng khỏi voucher");
  }
}

async function calculateOrderTotal(orderId, options = {}) {
  const { session } = options;
  try {
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      throw new Error(`Invalid order ID: ${orderId}`);
    }

    const itemOrders = await ItemOrder.find({ order_id: orderId })
      .populate("item_id")
      .session(session);
    if (!itemOrders.length) throw new Error("Đơn hàng không có sản phẩm");

    const totalAmount = itemOrders.reduce((total, itemOrder, index) => {
      if (!itemOrder.item_id) {
        throw new Error(`Sản phẩm không hợp lệ cho ItemOrder ${itemOrder._id}`);
      }
      let price = itemOrder.item_id.price;
      if (itemOrder.size) {
        const selectedSize = itemOrder.item_id.sizes.find(
          size => size.name.toLowerCase() === itemOrder.size.toLowerCase()
        );
        if (!selectedSize) {
          throw new Error(
            `Kích thước ${itemOrder.size} không hợp lệ cho sản phẩm ${itemOrder.item_id.name}`
          );
        }
        price = selectedSize.price;
      }
      if (!price && price !== 0) {
        throw new Error(`Sản phẩm ${itemOrder.item_id.name} thiếu giá`);
      }
      const itemTotal = itemOrder.quantity * price;
      return total + itemTotal;
    }, 0);

    if (totalAmount <= 0) {
      throw new Error("Tổng giá trị đơn hàng phải lớn hơn 0");
    }

    return totalAmount;
  } catch (error) {
    console.error(`Error calculating order total for ${orderId}:`, error.message);
    throw error;
  }
}

async function applyVoucher(orderId, voucherCode) {
  try {
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      throw new Error('Invalid order ID');
    }

    // Kiểm tra đơn hàng
    const order = await OrderDetail.findById(orderId);
    if (!order) throw new Error('Đơn hàng không tồn tại');

    // Kiểm tra voucher
    const voucher = await Voucher.findOne({ code: voucherCode, isActive: true });
    if (!voucher) throw new Error('Voucher không tồn tại hoặc không hoạt động');

    // Kiểm tra thời hạn
    const now = new Date();
    if (now < voucher.startDate || now > voucher.endDate) {
      throw new Error('Voucher đã hết hạn hoặc chưa bắt đầu');
    }

    // Kiểm tra giới hạn sử dụng
    if (voucher.usageLimit !== null && voucher.usedCount >= voucher.usageLimit) {
      throw new Error('Voucher đã hết lượt sử dụng');
    }

    // Tính tổng giá trị đơn hàng
    const totalAmount = await calculateOrderTotal(orderId); // Đã cập nhật total_amount trong hàm này

    // Kiểm tra giá trị đơn hàng tối thiểu
    if (totalAmount < voucher.minOrderValue) {
      throw new Error(
        `Đơn hàng phải đạt tối thiểu ${voucher.minOrderValue} để áp dụng voucher`
      );
    }

    // Tính chiết khấu
    let discountAmount = 0;
    if (voucher.discountType === 'percentage') {
      discountAmount = (voucher.discount / 100) * totalAmount;
    } else {
      discountAmount = voucher.discount;
    }

    const finalAmount = totalAmount - discountAmount;
    if (finalAmount < 0) {
      throw new Error('Tổng tiền sau giảm giá không thể âm');
    }

    // Cập nhật OrderDetail và Voucher
    await Promise.all([
      OrderDetail.findByIdAndUpdate(
        orderId,
        {
          voucher_id: voucher._id,
          total_amount: totalAmount,
          discount_amount: discountAmount,
          final_amount: finalAmount,
        },
        { new: true }
      ),
      Voucher.findByIdAndUpdate(
        voucher._id,
        { $inc: { usedCount: 1 } },
        { new: true }
      ),
    ]);

    console.log(`Applied voucher ${voucherCode} for order ${orderId}: total_amount=${totalAmount}, discount_amount=${discountAmount}, final_amount=${finalAmount}`);

    return {
      voucherId: voucher._id,
      code: voucher.code,
      discountAmount,
      originalAmount: totalAmount,
      finalAmount,
    };
  } catch (error) {
    console.error('Error applying voucher:', error);
    throw new Error(error.message || 'Lỗi khi áp dụng voucher');
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
  calculateOrderTotal,
  applyVoucher,
};

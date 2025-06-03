const mongoose = require("mongoose");
const canceledItemOrderService = require("../services/canceledItemOrder.service");

const createCanceledItemOrder = async (req, res) => {
  try {
    const { item_id, quantity, order_id, size, note, cancel_reason } = req.body;
    const canceled_by = req.user._id;

    if (!item_id || !quantity || !order_id || !cancel_reason) {
      return res.status(400).json({
        status: "ERROR",
        message: "item_id, quantity, order_id, và cancel_reason là bắt buộc!",
        data: null,
      });
    }

    if (!mongoose.isValidObjectId(item_id) || !mongoose.isValidObjectId(order_id)) {
      return res.status(400).json({
        status: "ERROR",
        message: "item_id hoặc order_id không hợp lệ!",
        data: null,
      });
    }

    const canceledItemOrderData = {
      item_id,
      quantity,
      order_id,
      size: size || undefined,
      note: note || "",
      cancel_reason,
      canceled_by,
    };

    await canceledItemOrderService.createCanceledItemOrder(canceledItemOrderData);

    return res.status(201).json({
      status: "SUCCESS",
      message: "Tạo bản ghi hủy món hàng thành công!",
      data: "", // Return empty string
    });
  } catch (error) {
    console.error("Lỗi khi tạo bản ghi hủy món hàng:", error);
    return res.status(500).json({
      status: "ERROR",
      message: error.message || "Đã xảy ra lỗi khi tạo bản ghi hủy món hàng!",
      data: null,
    });
  }
};

const getAllCanceledItemOrders = async (req, res) => {
  try {
    const canceledItemOrders = await canceledItemOrderService.getAllCanceledItemOrders();
    return res.status(200).json({
      status: "SUCCESS",
      message: "Retrieved all canceled item orders successfully!",
      data: canceledItemOrders, // Keep returning documents
    });
  } catch (error) {
    console.error("Error retrieving canceled item orders:", error);
    return res.status(500).json({
      status: "ERROR",
      message: error.message || "An error occurred while retrieving canceled item orders!",
      data: null,
    });
  }
};

const getCanceledItemOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        status: "ERROR",
        message: "Canceled item order ID is required!",
        data: null,
      });
    }

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        status: "ERROR",
        message: "Invalid canceled item order ID!",
        data: null,
      });
    }

    const canceledItemOrder = await canceledItemOrderService.getCanceledItemOrderById(id);
    if (!canceledItemOrder) {
      return res.status(404).json({
        status: "ERROR",
        message: "Canceled item order not found!",
        data: null,
      });
    }

    return res.status(200).json({
      status: "SUCCESS",
      message: "Retrieved canceled item order successfully!",
      data: canceledItemOrder, // Keep returning document
    });
  } catch (error) {
    console.error("Error retrieving canceled item order:", error);
    return res.status(400).json({
      status: "ERROR",
      message: error.message || "An error occurred while retrieving canceled item order!",
      data: null,
    });
  }
};

const updateCanceledItemOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { ...updateData } = req.body;

    if (!id) {
      return res.status(400).json({
        status: "ERROR",
        message: "Canceled item order ID is required!",
        data: null,
      });
    }

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        status: "ERROR",
        message: "Invalid canceled item order ID!",
        data: null,
      });
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      return res.status(400).json({
        status: "ERROR",
        message: "No fields provided for update!",
        data: null,
      });
    }

    if (updateData.item_id && !mongoose.isValidObjectId(updateData.item_id)) {
      return res.status(400).json({
        status: "ERROR",
        message: "Invalid item_id!",
        data: null,
      });
    }
    if (updateData.order_id && !mongoose.isValidObjectId(updateData.order_id)) {
      return res.status(400).json({
        status: "ERROR",
        message: "Invalid order_id!",
        data: null,
      });
    }

    const canceledItemOrder = await canceledItemOrderService.updateCanceledItemOrder(id, updateData);
    if (!canceledItemOrder) {
      return res.status(404).json({
        status: "ERROR",
        message: "Canceled item order not found!",
        data: null,
      });
    }

    return res.status(200).json({
      status: "SUCCESS",
      message: "Updated canceled item order successfully!",
      data: "", // Return empty string
    });
  } catch (error) {
    console.error("Error updating canceled item order:", error);
    return res.status(400).json({
      status: "ERROR",
      message: error.message || "An error occurred while updating canceled item order!",
      data: null,
    });
  }
};

const deleteCanceledItemOrder = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        status: "ERROR",
        message: "Canceled item order ID is required!",
        data: null,
      });
    }

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        status: "ERROR",
        message: "Invalid canceled item order ID!",
        data: null,
      });
    }

    const canceledItemOrder = await canceledItemOrderService.deleteCanceledItemOrder(id);
    if (!canceledItemOrder) {
      return res.status(404).json({
        status: "ERROR",
        message: "Canceled item order not found!",
        data: null,
      });
    }

    return res.status(200).json({
      status: "SUCCESS",
      message: "Deleted canceled item order successfully!",
      data: "", // Return empty string
    });
  } catch (error) {
    console.error("Error deleting canceled item order:", error);
    return res.status(400).json({
      status: "ERROR",
      message: error.message || "An error occurred while deleting canceled item order!",
      data: null,
    });
  }
};

module.exports = {
  createCanceledItemOrder,
  getAllCanceledItemOrders,
  getCanceledItemOrderById,
  updateCanceledItemOrder,
  deleteCanceledItemOrder,
};
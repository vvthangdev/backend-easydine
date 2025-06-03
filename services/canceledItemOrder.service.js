const mongoose = require("mongoose");
const CanceledItemOrder = require("../models/canceled_item_order.model");

const createCanceledItemOrder = async (data) => {
  const canceledItemOrder = new CanceledItemOrder(data);
  return await canceledItemOrder.save();
};

const getAllCanceledItemOrders = async () => {
  return await CanceledItemOrder.find()
    .populate({
      path: "item_id",
      select: "_id name price image" // Chỉ lấy các trường cần thiết
    })
    .populate({
      path: "order_id",
      select: "_id type status total_amount final_amount" // Chỉ lấy các trường cần thiết
    })
    .populate({
      path: "canceled_by",
      select: "_id username name role" // Chỉ lấy các trường cần thiết
    });
};

const getCanceledItemOrderById = async (id) => {
  return await CanceledItemOrder.findById(id)
    .populate({
      path: "item_id",
      select: "_id name price image"
    })
    .populate({
      path: "order_id",
      select: "_id type status total_amount final_amount"
    })
    .populate({
      path: "canceled_by",
      select: "_id username name role"
    });
};

const updateCanceledItemOrder = async (id, updateData) => {
  return await CanceledItemOrder.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
};

const deleteCanceledItemOrder = async (id) => {
  return await CanceledItemOrder.findByIdAndDelete(id);
};

module.exports = {
  createCanceledItemOrder,
  getAllCanceledItemOrders,
  getCanceledItemOrderById,
  updateCanceledItemOrder,
  deleteCanceledItemOrder,
};
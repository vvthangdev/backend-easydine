const mongoose = require("mongoose");
const CanceledItemOrder = require("../models/canceled_item_order.model");

const createCanceledItemOrder = async (data) => {
  const canceledItemOrder = new CanceledItemOrder(data);
  return await canceledItemOrder.save();
};

const getAllCanceledItemOrders = async () => {
  return await CanceledItemOrder.find().populate("item_id order_id canceled_by");
};

const getCanceledItemOrderById = async (id) => {
  return await CanceledItemOrder.findById(id).populate("item_id order_id canceled_by");
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
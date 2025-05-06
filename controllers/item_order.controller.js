const ItemOrder = require("../models/item_order.model");
const itemOrdService = require("../services/item_order.service");

const getAllItemOrds = async (req, res) => {
  try {
    const itemOrds = await ItemOrder.find();

    return res.status(200).json({
      status: "SUCCESS",
      message: "Item orders retrieved successfully!",
      data: itemOrds,
    });
  } catch (error) {
    console.error("Error fetching item orders:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "An error occurred while fetching item orders!",
      data: null,
    });
  }
};

const createItemOrd = async (req, res) => {
  try {
    const { ...itemOrdData } = req.body;

    if (!itemOrdData || Object.keys(itemOrdData).length === 0) {
      return res.status(400).json({
        status: "ERROR",
        message: "Item order data is required!",
        data: null,
      });
    }

    const newItemOrd = await itemOrdService.createItemOrd({ ...itemOrdData });

    return res.status(201).json({
      status: "SUCCESS",
      message: "Item order created successfully!",
      data: newItemOrd,
    });
  } catch (error) {
    console.error("Error creating item order:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "An error occurred while creating the item order!",
      data: null,
    });
  }
};

const updateItemOrd = async (req, res) => {
  try {
    const { id, ...otherFields } = req.body;

    if (!id) {
      return res.status(400).json({
        status: "ERROR",
        message: "Item order ID is required!",
        data: null,
      });
    }

    if (!otherFields || Object.keys(otherFields).length === 0) {
      return res.status(400).json({
        status: "ERROR",
        message: "No fields provided to update!",
        data: null,
      });
    }

    const updatedItemOrd = await itemOrdService.updateItemOrd(id, {
      ...otherFields,
    });

    if (!updatedItemOrd) {
      return res.status(404).json({
        status: "ERROR",
        message: "Item order not found!",
        data: null,
      });
    }

    return res.status(200).json({
      status: "SUCCESS",
      message: "Item order updated successfully!",
      data: updatedItemOrd,
    });
  } catch (error) {
    console.error("Error updating item order:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "An error occurred while updating the item order!",
      data: null,
    });
  }
};

const deleteItemOrd = async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({
        status: "ERROR",
        message: "Item order ID is required!",
        data: null,
      });
    }

    const itemOrd = await itemOrdService.getItemOrdByItemOrdId(id);
    if (typeof itemOrd === "string" || !itemOrd) {
      return res.status(404).json({
        status: "ERROR",
        message: "Item order not found!",
        data: null,
      });
    }

    await ItemOrder.deleteOne({ _id: id });

    return res.status(200).json({
        status: "SUCCESS",
        message: "Item order deleted successfully!",
        data: null,
    });
  } catch (error) {
    console.error("Error deleting item order:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "An error occurred while deleting the item order!",
      data: null,
    });
  }
};

module.exports = {
  getAllItemOrds,
  createItemOrd,
  updateItemOrd,
  deleteItemOrd,
};
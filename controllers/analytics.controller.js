const mongoose = require("mongoose");
const OrderDetail = require("../models/order_detail.model.js");
const ItemOrder = require("../models/item_order.model.js");
const CanceledItemOrder = require("../models/canceled_item_order.model.js");
const Item = require("../models/item.model.js");
const Category = require("../models/category.model.js");

const getOrderStatusDistribution = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const matchStage = {};
    if (startDate && endDate) {
      matchStage.time = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const data = await OrderDetail.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          status: "$_id",
          count: 1,
          _id: 0,
        },
      },
    ]);

    return res.status(200).json({
      status: "SUCCESS",
      message: "Lấy phân bố trạng thái đơn hàng thành công!",
      data,
    });
  } catch (error) {
    console.error("Lỗi khi lấy phân bố trạng thái đơn hàng:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "Đã xảy ra lỗi khi lấy phân bố trạng thái đơn hàng!",
      data: null,
    });
  }
};

const getRevenueTrend = async (req, res) => {
  try {
    const { startDate, endDate, interval = "day" } = req.query;
    const matchStage = {};
    if (startDate && endDate) {
      matchStage.time = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const groupBy = interval === "month"
      ? {
          $dateToString: {
            format: "%Y-%m",
            date: "$time",
          },
        }
      : {
          $dateToString: {
            format: "%Y-%m-%d",
            date: "$time",
          },
        };

    const data = await OrderDetail.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: groupBy,
          totalRevenue: { $sum: "$final_amount" },
        },
      },
      {
        $sort: { _id: 1 },
      },
      {
        $project: {
          date: "$_id",
          totalRevenue: 1,
          _id: 0,
        },
      },
    ]);

    return res.status(200).json({
      status: "SUCCESS",
      message: "Lấy xu hướng doanh thu thành công!",
      data,
    });
  } catch (error) {
    console.error("Lỗi khi lấy xu hướng doanh thu:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "Đã xảy ra lỗi khi lấy xu hướng doanh thu!",
      data: null,
    });
  }
};

const getPaymentMethodDistribution = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const matchStage = {};
    if (startDate && endDate) {
      matchStage.time = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const data = await OrderDetail.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$payment_method",
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          paymentMethod: "$_id",
          count: 1,
          _id: 0,
        },
      },
    ]);

    return res.status(200).json({
      status: "SUCCESS",
      message: "Lấy phân bố phương thức thanh toán thành công!",
      data,
    });
  } catch (error) {
    console.error("Lỗi khi lấy phân bố phương thức thanh toán:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "Đã xảy ra lỗi khi lấy phân bố phương thức thanh toán!",
      data: null,
    });
  }
};

const getPeopleVsAmount = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const matchStage = {};
    if (startDate && endDate) {
      matchStage.time = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const data = await OrderDetail.find(matchStage)
      .select("number_people final_amount")
      .lean()
      .exec();

    return res.status(200).json({
      status: "SUCCESS",
      message: "Lấy dữ liệu số lượng người và tổng tiền thành công!",
      data: data.map(item => ({
        numberPeople: item.number_people,
        finalAmount: item.final_amount,
      })),
    });
  } catch (error) {
    console.error("Lỗi khi lấy dữ liệu số lượng người và tổng tiền:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "Đã xảy ra lỗi khi lấy dữ liệu số lượng người và tổng tiền!",
      data: null,
    });
  }
};

const getCancelReasonDistribution = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const matchStage = {};
    if (startDate && endDate) {
      matchStage.canceled_at = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const data = await CanceledItemOrder.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$cancel_reason",
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          cancelReason: "$_id",
          count: 1,
          _id: 0,
        },
      },
    ]);

    return res.status(200).json({
      status: "SUCCESS",
      message: "Lấy phân bố lý do hủy đơn hàng thành công!",
      data,
    });
  } catch (error) {
    console.error("Lỗi khi lấy phân bố lý do hủy đơn hàng:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "Đã xảy ra lỗi khi lấy phân bố lý do hủy đơn hàng!",
      data: null,
    });
  }
};

const getItemSalesByCategory = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const matchStage = {};
    if (startDate && endDate) {
      matchStage["orderDetail.time"] = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const data = await ItemOrder.aggregate([
      {
        $lookup: {
          from: "orderdetails",
          localField: "order_id",
          foreignField: "_id",
          as: "orderDetail",
        },
      },
      { $unwind: "$orderDetail" },
      { $match: matchStage },
      {
        $lookup: {
          from: "items",
          localField: "item_id",
          foreignField: "_id",
          as: "item",
        },
      },
      { $unwind: "$item" },
      {
        $unwind: "$item.categories",
      },
      {
        $lookup: {
          from: "categories",
          localField: "item.categories",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: "$category" },
      {
        $group: {
          _id: "$category.name",
          totalQuantity: { $sum: "$quantity" },
        },
      },
      {
        $project: {
          category: "$_id",
          totalQuantity: 1,
          _id: 0,
        },
      },
    ]);

    return res.status(200).json({
      status: "SUCCESS",
      message: "Lấy số lượng bán ra theo danh mục thành công!",
      data,
    });
  } catch (error) {
    console.error("Lỗi khi lấy số lượng bán ra theo danh mục:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "Đã xảy ra lỗi khi lấy số lượng bán ra theo danh mục!",
      data: null,
    });
  }
};

const getItemCategoryDistribution = async (req, res) => {
  try {
    const data = await Item.aggregate([
      {
        $unwind: "$categories",
      },
      {
        $lookup: {
          from: "categories",
          localField: "categories",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: "$category" },
      {
        $group: {
          _id: "$category.name",
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          category: "$_id",
          count: 1,
          _id: 0,
        },
      },
    ]);

    return res.status(200).json({
      status: "SUCCESS",
      message: "Lấy phân bố món ăn theo danh mục thành công!",
      data,
    });
  } catch (error) {
    console.error("Lỗi khi lấy phân bố món ăn theo danh mục:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "Đã xảy ra lỗi khi lấy phân bố món ăn theo danh mục!",
      data: null,
    });
  }
};

module.exports = {
  getOrderStatusDistribution,
  getRevenueTrend,
  getPaymentMethodDistribution,
  getPeopleVsAmount,
  getCancelReasonDistribution,
  getItemSalesByCategory,
  getItemCategoryDistribution,
};
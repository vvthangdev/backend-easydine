const OrderDetail = require("../models/order_detail.model");
const orderService = require("../services/order.service");
const ReservedTable = require("../models/reservation_table.model");
const ItemOrder = require("../models/item_order.model");
const Item = require("../models/item.model");
const emailService = require("../services/send-email.service");
const { getUserByUserId } = require("../services/user.service");
const mongoose = require('mongoose'); // Thêm dòng này

const getAllOrders = async (req, res) => {
  try {
    const orderDetail = await OrderDetail.find();
    res.json(orderDetail);
  } catch (error) {
    res.status(500).json({ error: "Error fetching orders" });
  }
};

const getAllOrdersInfo = async (req, res) => {
  try {
    const orders = await OrderDetail.find();
    const enrichedOrders = await Promise.all(
      orders.map(async (order) => {
        const itemOrders = await ItemOrder.find({ order_id: order._id });
        let totalAmount = 0;
        for (const itemOrder of itemOrders) {
          const item = await Item.findById(itemOrder.item_id);
          if (item) totalAmount += item.price * itemOrder.quantity;
        }
        return {
          id: order._id,
          time: order.time,
          num_people: order.num_people || 0,
          totalAmount,
          type: order.type
        };
      })
    );
    res.json(enrichedOrders);
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ error: "Error fetching orders" });
  }
};

const getOrderInfo = async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "Order ID is required" });

    const reservedTables = await ReservedTable.find({ reservation_id: id });
    const itemOrders = await ItemOrder.find({ order_id: id });
    const enrichedItemOrders = await Promise.all(
      itemOrders.map(async (itemOrder) => {
        const item = await Item.findById(itemOrder.item_id);
        return {
          ...itemOrder._doc,
          itemName: item ? item.name : null,
          itemImage: item ? item.image : null,
          itemPrice: item ? item.price : null
        };
      })
    );

    res.json({
      status: "SUCCESS",
      message: "Order details fetched successfully",
      reservedTables,
      itemOrders: enrichedItemOrders
    });
  } catch (error) {
    console.error("Error fetching order info:", error);
    res.status(500).json({ error: "Error fetching order info" });
  }
};

const getAllOrdersOfCustomer = async (req, res) => {
  try {
    const customer_id = req.user._id;
    const orders = await OrderDetail.find({ customer_id });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: "Error fetching orders" });
  }
};

const createOrder = async (req, res) => {
  try {
    let { start_time, num_people, items, ...orderData } = req.body;
    const user = await getUserByUserId(req.user._id);

    const newOrder = await orderService.createOrder({
      customer_id: req.user._id,
      time: start_time,
      num_people,
      ...orderData
    });

    const startTime = newOrder.time;
    const offsetMinutes = parseInt(process.env.END_TIME_OFFSET_MINUTES) || 120;
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + offsetMinutes);

    const availableTables = await orderService.checkAvailableTables(startTime, endTime);
    if (availableTables && availableTables.length > 0) {
      let remainingPeople = num_people;
      let reservedTables = [];
      let totalCapacity = 0;

      for (let table of availableTables) {
        totalCapacity += table.capacity;
        if (remainingPeople > 0) {
          const peopleAssignedToTable = Math.min(remainingPeople, table.capacity);
          remainingPeople -= peopleAssignedToTable;
          reservedTables.push({
            reservation_id: newOrder._id,
            table_id: table.table_number,
            people_assigned: peopleAssignedToTable,
            start_time: startTime,
            end_time: endTime
          });
        }
        if (remainingPeople <= 0) break;
      }

      if (remainingPeople > 0) {
        await OrderDetail.findByIdAndDelete(newOrder._id);
        return res.status(400).json({ error: "Not enough available tables to seat all guests." });
      }

      await orderService.createReservations(reservedTables);

      if (items && items.length > 0) {
        let itemOrders = items.map((item) => ({
          item_id: new mongoose.Types.ObjectId(item.id), // Dòng này cần mongoose
          quantity: item.quantity,
          order_id: newOrder._id
        }));
        await orderService.createItemOrders(itemOrders);
      }

      await emailService.sendOrderConfirmationEmail(user.email, user.name, newOrder);
      res.status(201).json(newOrder);
    } else {
      await OrderDetail.findByIdAndDelete(newOrder._id);
      res.status(400).json({ error: "No available tables for the selected time" });
    }
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({ error: "Error creating order" });
  }
};

const updateOrder = async (req, res) => {
  try {
    const { id, ...otherFields } = req.body;
    if (!id) return res.status(400).send("Order number required.");
    if (!otherFields || Object.keys(otherFields).length === 0) {
      return res.status(400).send("No fields to update.");
    }

    const updatedOrder = await orderService.updateOrder(id, otherFields);
    if (!updatedOrder) return res.status(404).send("Order not found!");

    res.json({
      status: "SUCCESS",
      message: "Order updated successfully!",
      Order: updatedOrder
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error updating order" });
  }
};

const deleteOrder = async (req, res) => {
  const { id } = req.params;
  try {
    const order = await OrderDetail.findByIdAndDelete(id);
    if (!order) return res.status(404).json({ error: "Order not found!" });

    res.status(200).json({ message: "Order deleted successfully!" });
  } catch (error) {
    console.error("Error deleting order:", error);
    res.status(500).json({ error: "Error deleting order" });
  }
};

module.exports = {
  getAllOrders,
  getAllOrdersInfo,
  getOrderInfo,
  createOrder,
  updateOrder,
  getAllOrdersOfCustomer,
  deleteOrder
};
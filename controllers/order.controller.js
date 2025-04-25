const OrderDetail = require("../models/order_detail.model");
const orderService = require("../services/order.service");
const ReservedTable = require("../models/reservation_table.model");
const ItemOrder = require("../models/item_order.model");
const Item = require("../models/item.model");
const emailService = require("../services/send-email.service");
const { getUserByUserId } = require("../services/user.service");
const mongoose = require('mongoose');

const createOrder = async (req, res) => {
  try {
    let { start_time, end_time, tables, items, ...orderData } = req.body;
    const user = await getUserByUserId(req.user._id);

    if (!start_time || !end_time) {
      return res.status(400).json({ error: "start_time and end_time are required" });
    }
    if (orderData.type === 'reservation' && (!tables || tables.length === 0)) {
      return res.status(400).json({ error: "At least one table is required for reservation" });
    }

    const newOrder = await orderService.createOrder({
      customer_id: req.user._id,
      time: new Date(start_time),
      ...orderData
    });

    if (orderData.type === 'reservation') {
      const startTime = new Date(start_time);
      const endTime = new Date(end_time);

      const unavailableTables = await orderService.checkUnavailableTables(startTime, endTime, tables);
      if (unavailableTables.length > 0) {
        await OrderDetail.findByIdAndDelete(newOrder._id);
        return res.status(400).json({ 
          error: "Some selected tables are not available",
          unavailable: unavailableTables
        });
      }

      const reservedTables = tables.map(tableId => ({
        reservation_id: newOrder._id,
        table_id: tableId,
        start_time: startTime,
        end_time: endTime
      }));

      await orderService.createReservations(reservedTables);
    }

    if (items && items.length > 0) {
      for (const item of items) {
        if (!item.id || !mongoose.Types.ObjectId.isValid(item.id)) {
          await OrderDetail.findByIdAndDelete(newOrder._id);
          return res.status(400).json({ error: "Invalid item ID" });
        }
        if (!item.quantity || item.quantity < 1) {
          await OrderDetail.findByIdAndDelete(newOrder._id);
          return res.status(400).json({ error: "Quantity must be a positive number" });
        }
        const itemExists = await Item.findById(item.id);
        if (!itemExists) {
          await OrderDetail.findByIdAndDelete(newOrder._id);
          return res.status(400).json({ error: `Item with ID ${item.id} not found` });
        }
        if (item.size) {
          const validSize = itemExists.sizes.find(s => s.name === item.size);
          if (!validSize) {
            await OrderDetail.findByIdAndDelete(newOrder._id);
            return res.status(400).json({ error: `Invalid size ${item.size} for item ${itemExists.name}` });
          }
        }
      }

      let itemOrders = items.map((item) => ({
        item_id: new mongoose.Types.ObjectId(item.id),
        quantity: item.quantity,
        order_id: newOrder._id,
        size: item.size || null,
        note: item.note || ""
      }));
      await orderService.createItemOrders(itemOrders);
    }

    await emailService.sendOrderConfirmationEmail(user.email, user.name, newOrder);
    res.status(201).json(newOrder);
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({ error: "Error creating order" });
  }
};

const updateOrder = async (req, res) => {
  try {
    const { id, start_time, end_time, tables, items, ...otherFields } = req.body;
    if (!id) return res.status(400).send("Order ID required.");

    const order = await OrderDetail.findById(id);
    if (!order) return res.status(404).send("Order not found!");

    if (req.user.role !== 'ADMIN' && order.customer_id.toString() !== req.user._id) {
      return res.status(403).json({ error: "You can only update your own orders" });
    }

    const updateData = { ...otherFields };
    if (start_time) updateData.time = new Date(start_time);

    const updatedOrder = await orderService.updateOrder(id, updateData);
    if (!updatedOrder) return res.status(404).send("Order not found!");

    if (order.type === 'reservation' && tables !== undefined) {
      if (tables.length > 0) {
        if (!start_time || !end_time) {
          return res.status(400).json({ error: "start_time and end_time are required when updating tables" });
        }

        const startTime = new Date(start_time);
        const endTime = new Date(end_time);

        const unavailableTables = await orderService.checkUnavailableTables(startTime, endTime, tables, id);
        if (unavailableTables.length > 0) {
          return res.status(400).json({ 
            error: "Some selected tables are not available",
            unavailable: unavailableTables
          });
        }

        await ReservedTable.deleteMany({ reservation_id: id });
        const newReservations = tables.map(tableId => ({
          reservation_id: id,
          table_id: tableId,
          start_time: startTime,
          end_time: endTime
        }));
        await orderService.createReservations(newReservations);
      } else {
        await ReservedTable.deleteMany({ reservation_id: id });
        console.log(`Removed all table reservations for order ${id}`);
      }
    }

    if (items !== undefined) {
      await ItemOrder.deleteMany({ order_id: id });

      if (items.length > 0) {
        for (const item of items) {
          if (!item.id || !mongoose.Types.ObjectId.isValid(item.id)) {
            return res.status(400).json({ error: "Invalid item ID" });
          }
          if (!item.quantity || item.quantity < 1) {
            return res.status(400).json({ error: "Quantity must be a positive number" });
          }
          const itemExists = await Item.findById(item.id);
          if (!itemExists) {
            return res.status(400).json({ error: `Item with ID ${item.id} not found` });
          }
          if (item.size) {
            const validSize = itemExists.sizes.find(s => s.name === item.size);
            if (!validSize) {
              return res.status(400).json({ error: `Invalid size ${item.size} for item ${itemExists.name}` });
            }
          }
        }

        const newItemOrders = items.map((item) => ({
          item_id: new mongoose.Types.ObjectId(item.id),
          quantity: item.quantity,
          order_id: id,
          size: item.size || null,
          note: item.note || ""
        }));
        await orderService.createItemOrders(newItemOrders);
      }
    }

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

const getOrderInfo = async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "Order ID is required" });

    const order = await OrderDetail.findById(id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    if (req.user.role !== 'ADMIN' && order.customer_id.toString() !== req.user._id) {
      return res.status(403).json({ error: "You can only view your own orders" });
    }

    const reservedTables = await ReservedTable.find({ reservation_id: id });
    const itemOrders = await ItemOrder.find({ order_id: id });
    const enrichedItemOrders = await Promise.all(
      itemOrders.map(async (itemOrder) => {
        const item = await Item.findById(itemOrder.item_id);
        const sizeInfo = item && itemOrder.size && item.sizes ? 
          item.sizes.find(s => s.name === itemOrder.size) : null;
        return {
          ...itemOrder._doc,
          itemName: item ? item.name : null,
          itemImage: item ? item.image : null,
          itemPrice: sizeInfo ? sizeInfo.price : (item ? item.price : null),
          size: itemOrder.size,
          note: itemOrder.note
        };
      })
    );

    res.json({
      status: "SUCCESS",
      message: "Order details fetched successfully",
      order: {
        id: order._id,
        customer_id: order.customer_id,
        time: order.time,
        type: order.type,
        status: order.status
      },
      reservedTables,
      itemOrders: enrichedItemOrders
    });
  } catch (error) {
    console.error("Error fetching order info:", error);
    res.status(500).json({ error: "Error fetching order info" });
  }
};

const getAllOrders = async (req, res) => {
  try {
    let orderDetail;
    if (req.user.role === 'ADMIN') {
      orderDetail = await OrderDetail.find();
    } else {
      orderDetail = await OrderDetail.find({ customer_id: req.user._id });
    }
    res.json(orderDetail);
  } catch (error) {
    res.status(500).json({ error: "Error fetching orders" });
  }
};

const getAllOrdersInfo = async (req, res) => {
  try {
    let orders;
    if (req.user.role === 'admin') {
      orders = await OrderDetail.find();
    } else {
      orders = await OrderDetail.find({ customer_id: req.user._id });
    }

    const enrichedOrders = await Promise.all(
      orders.map(async (order) => {
        const itemOrders = await ItemOrder.find({ order_id: order._id });
        let totalAmount = 0;
        for (const itemOrder of itemOrders) {
          const item = await Item.findById(itemOrder.item_id);
          if (item) {
            const sizeInfo = itemOrder.size && item.sizes ? 
              item.sizes.find(s => s.name === itemOrder.size) : null;
            totalAmount += (sizeInfo ? sizeInfo.price : item.price) * itemOrder.quantity;
          }
        }
        return {
          id: order._id,
          time: order.time,
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

const getUserOrders = async (req, res) => {
  try {
    const customer_id = req.user._id;
    const orders = await OrderDetail.find({ customer_id });
    res.json(orders);
  } catch (error) {
    console.error("Error fetching user orders:", error);
    res.status(500).json({ error: "Error fetching user orders" });
  }
};

const searchOrdersByCustomerId = async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: "Only ADMIN can access this endpoint" });
    }
    const { customer_id } = req.query;
    if (!customer_id) return res.status(400).json({ error: "customer_id is required" });
    if (!mongoose.Types.ObjectId.isValid(customer_id)) {
      return res.status(400).json({ error: "Invalid customer_id" });
    }
    const orders = await OrderDetail.find({ customer_id: new mongoose.Types.ObjectId(customer_id) });
    res.json(orders);
  } catch (error) {
    console.error("Error searching orders by customer_id:", error);
    res.status(500).json({ error: "Error searching orders" });
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

const getAvailableTables = async (req, res) => {
  try {
    const { start_time, end_time } = req.query;
    if (!start_time || !end_time) {
      return res.status(400).json({ error: "start_time and end_time are required" });
    }
    const startTime = new Date(start_time);
    const endTime = new Date(end_time);
    if (isNaN(startTime) || isNaN(endTime)) {
      return res.status(400).json({ error: "Invalid date format" });
    }
    const availableTables = await orderService.getAvailableTables(startTime, endTime);
    res.status(200).json(availableTables);
  } catch (error) {
    console.error("Error fetching available tables:", error);
    res.status(500).json({ error: "Error fetching available tables" });
  }
};

module.exports = {
  getAllOrders,
  getAllOrdersInfo,
  getOrderInfo,
  createOrder,
  updateOrder,
  getUserOrders,
  searchOrdersByCustomerId,
  deleteOrder,
  getAvailableTables,
};
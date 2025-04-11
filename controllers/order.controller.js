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
    let orderDetail;
    if (req.user.role === 'ADMIN') {
      // Admin: Lấy tất cả đơn hàng
      orderDetail = await OrderDetail.find();
    } else {
      // Người dùng: Chỉ lấy đơn hàng của họ
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

    // Tìm đơn hàng theo ID
    const order = await OrderDetail.findById(id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    // Phân quyền
    if (req.user.role !== 'ADMIN' && order.customer_id.toString() !== req.user._id) {
      return res.status(403).json({ error: "You can only view your own orders" });
    }

    // Lấy thông tin bổ sung
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

    // Trả về thông tin chi tiết
    res.json({
      status: "SUCCESS",
      message: "Order details fetched successfully",
      order: {
        id: order._id,
        customer_id: order.customer_id,
        time: order.time,
        type: order.type,
        num_people: order.num_people,
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

// API cho người dùng: Lấy tất cả đơn hàng của chính họ
const getUserOrders = async (req, res) => {
  try {
    const customer_id = req.user._id; // Lấy _id từ token của người dùng hiện tại
    const orders = await OrderDetail.find({ customer_id });
    res.json(orders);
  } catch (error) {
    console.error("Error fetching user orders:", error);
    res.status(500).json({ error: "Error fetching user orders" });
  }
};

const searchOrdersByCustomerId = async (req, res) => {
  try {
    // Kiểm tra quyền ADMIN
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: "Only ADMIN can access this endpoint" });
    }

    const { customer_id } = req.query;
    if (!customer_id) {
      return res.status(400).json({ error: "customer_id is required" });
    }

    // Kiểm tra customer_id hợp lệ
    if (!mongoose.Types.ObjectId.isValid(customer_id)) {
      return res.status(400).json({ error: "Invalid customer_id" });
    }

    // Tìm đơn hàng theo customer_id
    const orders = await OrderDetail.find({ customer_id: new mongoose.Types.ObjectId(customer_id) });
    res.json(orders);
  } catch (error) {
    console.error("Error searching orders by customer_id:", error);
    res.status(500).json({ error: "Error searching orders" });
  }
};

const createOrder = async (req, res) => {
  try {
    let { start_time, end_time, tables, items, ...orderData } = req.body;
    const user = await getUserByUserId(req.user._id);

    // Kiểm tra các trường bắt buộc
    if (!start_time || !end_time) {
      return res.status(400).json({ error: "start_time and end_time are required" });
    }
    if (orderData.type === 'reservation' && (!tables || tables.length === 0)) {
      return res.status(400).json({ error: "At least one table is required for reservation" });
    }

    const newOrder = await orderService.createOrder({
      customer_id: req.user._id,
      time: start_time,
      ...orderData
    });

    // Xử lý đặt bàn (nếu là reservation)
    if (orderData.type === 'reservation') {
      const startTime = new Date(start_time);
      const endTime = new Date(end_time);

      // Kiểm tra các bàn có sẵn không
      const unavailableTables = await orderService.checkUnavailableTables(startTime, endTime, tables);
      if (unavailableTables.length > 0) {
        await OrderDetail.findByIdAndDelete(newOrder._id);
        return res.status(400).json({ 
          error: "Some selected tables are not available",
          unavailable: unavailableTables
        });
      }

      // Tạo danh sách reservation
      const reservedTables = tables.map(tableId => ({
        reservation_id: newOrder._id,
        table_id: tableId,
        start_time: startTime,
        end_time: endTime
      }));

      await orderService.createReservations(reservedTables);
    }

    // Xử lý items (nếu có)
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
      }

      let itemOrders = items.map((item) => ({
        item_id: new mongoose.Types.ObjectId(item.id),
        quantity: item.quantity,
        order_id: newOrder._id
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

    // Kiểm tra quyền
    if (req.user.role !== 'ADMIN' && order.customer_id.toString() !== req.user._id) {
      return res.status(403).json({ error: "You can only update your own orders" });
    }

    const updateData = { ...otherFields };
    if (start_time) updateData.time = start_time;

    // Cập nhật đơn hàng cơ bản
    const updatedOrder = await orderService.updateOrder(id, updateData);
    if (!updatedOrder) return res.status(404).send("Order not found!");

    // Cập nhật bàn (nếu có)
    if (order.type === 'reservation' && tables) {
      if (!start_time || !end_time) {
        return res.status(400).json({ error: "start_time and end_time are required when updating tables" });
      }

      const startTime = new Date(start_time);
      const endTime = new Date(end_time);

      // Kiểm tra bàn có sẵn không (loại trừ đơn hàng hiện tại)
      const unavailableTables = await orderService.checkUnavailableTables(startTime, endTime, tables, id);
      if (unavailableTables.length > 0) {
        return res.status(400).json({ 
          error: "Some selected tables are not available",
          unavailable: unavailableTables
        });
      }

      // Xóa các reservation cũ và tạo mới
      await ReservedTable.deleteMany({ reservation_id: id });
      const newReservations = tables.map(tableId => ({
        reservation_id: id,
        table_id: tableId,
        start_time: startTime,
        end_time: endTime
      }));
      await orderService.createReservations(newReservations);
    }

    // Cập nhật món ăn (nếu có)
    if (items !== undefined) {
      // Xóa các ItemOrder cũ
      await ItemOrder.deleteMany({ order_id: id });

      // Thêm ItemOrder mới (nếu items không rỗng)
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
        }

        const newItemOrders = items.map((item) => ({
          item_id: new mongoose.Types.ObjectId(item.id),
          quantity: item.quantity,
          order_id: id
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

// Hàm mới: Lấy danh sách bàn khả dụng
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
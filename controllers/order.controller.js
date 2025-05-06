const OrderDetail = require("../models/order_detail.model");
const orderService = require("../services/order.service");
const ReservedTable = require("../models/reservation_table.model");
const TableInfo = require("../models/table_info.model");
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
      return res.status(400).json({
        status: "ERROR",
        message: "start_time and end_time are required!",
        data: null,
      });
    }
    if (orderData.type === 'reservation' && (!tables || tables.length === 0)) {
      return res.status(400).json({
        status: "ERROR",
        message: "At least one table is required for reservation!",
        data: null,
      });
    }

    const newOrderData = {
      customer_id: req.user._id,
      time: new Date(start_time),
      ...orderData,
    };

    if (orderData.status === 'confirmed') {
      newOrderData.staff_id = req.user._id;
    }

    const newOrder = await orderService.createOrder(newOrderData);

    if (orderData.type === 'reservation') {
      const startTime = new Date(start_time);
      const endTime = new Date(end_time);

      const unavailableTables = await orderService.checkUnavailableTables(startTime, endTime, tables);
      if (unavailableTables.length > 0) {
        await OrderDetail.findByIdAndDelete(newOrder._id);
        return res.status(400).json({
          status: "ERROR",
          message: "Some selected tables are not available!",
          data: { unavailable: unavailableTables },
        });
      }

      const reservedTables = tables.map(tableId => ({
        reservation_id: newOrder._id,
        table_id: tableId,
        start_time: startTime,
        end_time: endTime,
      }));

      await orderService.createReservations(reservedTables);
    }

    if (items && items.length > 0) {
      for (const item of items) {
        if (!item.id || !mongoose.Types.ObjectId.isValid(item.id)) {
          await OrderDetail.findByIdAndDelete(newOrder._id);
          return res.status(400).json({
            status: "ERROR",
            message: "Invalid item ID!",
            data: null,
          });
        }
        if (!item.quantity || item.quantity < 1) {
          await OrderDetail.findByIdAndDelete(newOrder._id);
          return res.status(400).json({
            status: "ERROR",
            message: "Quantity must be a positive number!",
            data: null,
          });
        }
        const itemExists = await Item.findById(item.id);
        if (!itemExists) {
          await OrderDetail.findByIdAndDelete(newOrder._id);
          return res.status(400).json({
            status: "ERROR",
            message: `Item with ID ${item.id} not found!`,
            data: null,
          });
        }
        if (item.size) {
          const validSize = itemExists.sizes.find(s => s.name === item.size);
          if (!validSize) {
            await OrderDetail.findByIdAndDelete(newOrder._id);
            return res.status(400).json({
              status: "ERROR",
              message: `Invalid size ${item.size} for item ${itemExists.name}!`,
              data: null,
            });
          }
        }
      }

      let itemOrders = items.map((item) => ({
        item_id: new mongoose.Types.ObjectId(item.id),
        quantity: item.quantity,
        order_id: newOrder._id,
        size: item.size || null,
        note: item.note || "",
      }));
      await orderService.createItemOrders(itemOrders);
    }

    await emailService.sendOrderConfirmationEmail(user.email, user.name, newOrder);

    return res.status(201).json({
      status: "SUCCESS",
      message: "Order created successfully!",
      data: newOrder,
    });
  } catch (error) {
    console.error("Error creating order:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "An error occurred while creating the order!",
      data: null,
    });
  }
};

const updateOrder = async (req, res) => {
  try {
    const { id, start_time, end_time, tables, items, ...otherFields } = req.body;

    if (!id) {
      return res.status(400).json({
        status: "ERROR",
        message: "Order ID is required!",
        data: null,
      });
    }

    const order = await OrderDetail.findById(id);
    if (!order) {
      return res.status(404).json({
        status: "ERROR",
        message: "Order not found!",
        data: null,
      });
    }

    if (req.user.role !== 'ADMIN' && order.customer_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: "ERROR",
        message: "You can only update your own orders!",
        data: null,
      });
    }

    const updateData = { ...otherFields };
    if (start_time) updateData.time = new Date(start_time);

    if (order.status === 'pending' && otherFields.status === 'confirmed') {
      updateData.staff_id = req.user._id;
    }

    const updatedOrder = await orderService.updateOrder(id, updateData);
    if (!updatedOrder) {
      return res.status(404).json({
        status: "ERROR",
        message: "Order not found!",
        data: null,
      });
    }

    if (order.type === 'reservation' && tables !== undefined) {
      if (tables.length > 0) {
        if (!start_time || !end_time) {
          return res.status(400).json({
            status: "ERROR",
            message: "start_time and end_time are required when updating tables!",
            data: null,
          });
        }

        const startTime = new Date(start_time);
        const endTime = new Date(end_time);

        const unavailableTables = await orderService.checkUnavailableTables(startTime, endTime, tables, id);
        if (unavailableTables.length > 0) {
          return res.status(400).json({
            status: "ERROR",
            message: "Some selected tables are not available!",
            data: { unavailable: unavailableTables },
          });
        }

        await ReservedTable.deleteMany({ reservation_id: id });
        const newReservations = tables.map(tableId => ({
          reservation_id: id,
          table_id: tableId,
          start_time: startTime,
          end_time: endTime,
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
            return res.status(400).json({
              status: "ERROR",
              message: "Invalid item ID!",
              data: null,
            });
          }
          if (!item.quantity || item.quantity < 1) {
            return res.status(400).json({
              status: "ERROR",
              message: "Quantity must be a positive number!",
              data: null,
            });
          }
          const itemExists = await Item.findById(item.id);
          if (!itemExists) {
            return res.status(400).json({
              status: "ERROR",
              message: `Item with ID ${item.id} not found!`,
              data: null,
            });
          }
          if (item.size) {
            const validSize = itemExists.sizes.find(s => s.name === item.size);
            if (!validSize) {
              return res.status(400).json({
                status: "ERROR",
                message: `Invalid size ${item.size} for item ${itemExists.name}!`,
                data: null,
              });
            }
          }
        }

        const newItemOrders = items.map((item) => ({
          item_id: new mongoose.Types.ObjectId(item.id),
          quantity: item.quantity,
          order_id: id,
          size: item.size || null,
          note: item.note || "",
        }));
        await orderService.createItemOrders(newItemOrders);
      }
    }

    return res.status(200).json({
      status: "SUCCESS",
      message: "Order updated successfully!",
      data: updatedOrder,
    });
  } catch (error) {
    console.error("Error updating order:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "An error occurred while updating the order!",
      data: null,
    });
  }
};

const getOrderInfo = async (req, res) => {
  try {
    const { id, table_number } = req.query;

    if (!id && !table_number) {
      return res.status(400).json({
        status: "ERROR",
        message: "Either order ID or table_number is required!",
        data: null,
      });
    }
    if (id && table_number) {
      return res.status(400).json({
        status: "ERROR",
        message: "Please provide either order ID or table_number, not both!",
        data: null,
      });
    }

    let order;

    if (id) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          status: "ERROR",
          message: "Invalid order ID!",
          data: null,
        });
      }
      order = await OrderDetail.findById(id);
    } else if (table_number) {
      if (isNaN(table_number)) {
        return res.status(400).json({
          status: "ERROR",
          message: "table_number must be a valid number!",
          data: null,
        });
      }

      const reservedTable = await ReservedTable.findOne({
        table_id: parseInt(table_number),
        start_time: { $lte: new Date() },
        end_time: { $gte: new Date() },
      });

      if (!reservedTable) {
        return res.status(404).json({
          status: "ERROR",
          message: `No active order found for table ${table_number}!`,
          data: null,
        });
      }

      order = await OrderDetail.findById(reservedTable.reservation_id);
    }

    if (!order) {
      return res.status(404).json({
        status: "ERROR",
        message: "Order not found!",
        data: null,
      });
    }

    if (req.user.role !== 'ADMIN' && order.customer_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: "ERROR",
        message: "You can only view your own orders!",
        data: null,
      });
    }

    const reservedTables = await ReservedTable.find({ reservation_id: order._id });
    const itemOrders = await ItemOrder.find({ order_id: order._id });
    const enrichedItemOrders = await Promise.all(
      itemOrders.map(async (itemOrder) => {
        const item = await Item.findById(itemOrder.item_id);
        const sizeInfo = item && itemOrder.size && item.sizes
          ? item.sizes.find(s => s.name === itemOrder.size)
          : null;
        return {
          ...itemOrder._doc,
          itemName: item ? item.name : null,
          itemImage: item ? item.image : null,
          itemPrice: sizeInfo ? sizeInfo.price : (item ? item.price : null),
          size: itemOrder.size,
          note: itemOrder.note,
        };
      })
    );

    return res.status(200).json({
      status: "SUCCESS",
      message: "Order details fetched successfully!",
      data: {
        order: {
          id: order._id,
          customer_id: order.customer_id,
          staff_id: order.staff_id,
          time: order.time,
          type: order.type,
          status: order.status,
        },
        reservedTables,
        itemOrders: enrichedItemOrders,
      },
    });
  } catch (error) {
    console.error("Error fetching order info:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "An error occurred while fetching order info!",
      data: null,
    });
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

    return res.status(200).json({
      status: "SUCCESS",
      message: "Orders retrieved successfully!",
      data: orderDetail,
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "An error occurred while fetching orders!",
      data: null,
    });
  }
};

const getAllOrdersInfo = async (req, res) => {
  try {
    let orders;
    if (req.user.role === 'ADMIN') {
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
            const sizeInfo = itemOrder.size && item.sizes
              ? item.sizes.find(s => s.name === itemOrder.size)
              : null;
            totalAmount += (sizeInfo ? sizeInfo.price : item.price) * itemOrder.quantity;
          }
        }
        return {
          id: order._id,
          time: order.time,
          totalAmount,
          type: order.type,
        };
      })
    );

    return res.status(200).json({
      status: "SUCCESS",
      message: "Orders info retrieved successfully!",
      data: enrichedOrders,
    });
  } catch (error) {
    console.error("Error fetching orders info:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "An error occurred while fetching orders info!",
      data: null,
    });
  }
};

const getUserOrders = async (req, res) => {
  try {
    const customer_id = req.user._id;
    const orders = await OrderDetail.find({ customer_id });

    return res.status(200).json({
      status: "SUCCESS",
      message: "User orders retrieved successfully!",
      data: orders,
    });
  } catch (error) {
    console.error("Error fetching user orders:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "An error occurred while fetching user orders!",
      data: null,
    });
  }
};

const searchOrdersByCustomerId = async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({
        status: "ERROR",
        message: "Only ADMIN can access this endpoint!",
        data: null,
      });
    }

    const { customer_id } = req.query;
    if (!customer_id) {
      return res.status(400).json({
        status: "ERROR",
        message: "customer_id is required!",
        data: null,
      });
    }
    if (!mongoose.Types.ObjectId.isValid(customer_id)) {
      return res.status(400).json({
        status: "ERROR",
        message: "Invalid customer_id!",
        data: null,
      });
    }

    const orders = await OrderDetail.find({ customer_id: new mongoose.Types.ObjectId(customer_id) });

    return res.status(200).json({
      status: "SUCCESS",
      message: "Orders retrieved successfully!",
      data: orders,
    });
  } catch (error) {
    console.error("Error searching orders by customer_id:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "An error occurred while searching orders!",
      data: null,
    });
  }
};

const deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: "ERROR",
        message: "Valid order ID is required!",
        data: null,
      });
    }

    const order = await OrderDetail.findByIdAndDelete(id);
    if (!order) {
      return res.status(404).json({
        status: "ERROR",
        message: "Order not found!",
        data: null,
      });
    }

    return res.status(200).json({
      status: "SUCCESS",
      message: "Order deleted successfully!",
      data: null,
    });
  } catch (error) {
    console.error("Error deleting order:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "An error occurred while deleting the order!",
      data: null,
    });
  }
};

const confirmOrder = async (req, res) => {
  try {
    const { order_id } = req.body;
    const user = req.user;

    if (!order_id || !mongoose.Types.ObjectId.isValid(order_id)) {
      return res.status(400).json({
        status: "ERROR",
        message: "Valid order_id is required!",
        data: null,
      });
    }

    const order = await OrderDetail.findById(order_id);
    if (!order) {
      return res.status(404).json({
        status: "ERROR",
        message: "Order not found!",
        data: null,
      });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({
        status: "ERROR",
        message: "Only pending orders can be confirmed!",
        data: null,
      });
    }

    order.status = 'confirmed';
    order.staff_id = user._id;
    await order.save();

    return res.status(200).json({
      status: "SUCCESS",
      message: "Xác nhận đơn hàng thành công",
      data: {
        order: {
          _id: order._id,
          customer_id: order.customer_id,
          staff_id: order.staff_id,
          time: order.time,
          type: order.type,
          status: order.status,
          star: order.star,
          comment: order.comment,
        },
      },
    });
  } catch (error) {
    console.error("Error confirming order:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "An error occurred while confirming the order!",
      data: null,
    });
  }
};

const splitOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { table_number, new_items } = req.body;

    if (!table_number || isNaN(table_number)) {
      throw new Error("table_number phải là một số hợp lệ");
    }
    if (!new_items || !Array.isArray(new_items) || new_items.length === 0) {
      throw new Error("new_items phải là một mảng không rỗng");
    }

    const reservedTable = await ReservedTable.findOne({
      table_id: table_number,
      start_time: { $lte: new Date() },
      end_time: { $gte: new Date() },
    }).session(session);

    if (!reservedTable) {
      throw new Error(`Không tìm thấy đơn hàng đang hoạt động cho bàn ${table_number}`);
    }

    const originalOrder = await OrderDetail.findById(reservedTable.reservation_id).session(session);
    if (!originalOrder) {
      throw new Error("Không tìm thấy đơn hàng gốc");
    }
    if (!['pending', 'confirmed'].includes(originalOrder.status)) {
      throw new Error("Chỉ có thể tách đơn hàng ở trạng thái pending hoặc confirmed");
    }

    const originalItemOrders = await ItemOrder.find({ order_id: originalOrder._id }).lean();
    if (!originalItemOrders.length) {
      throw new Error("Không tìm thấy món ăn trong đơn hàng gốc");
    }

    const originalQuantities = {};
    originalItemOrders.forEach(item => {
      originalQuantities[item.item_id.toString()] = {
        quantity: item.quantity,
        size: item.size,
        note: item.note,
      };
    });

    const newQuantities = {};
    for (const item of new_items) {
      if (!item.id || !mongoose.Types.ObjectId.isValid(item.id)) {
        throw new Error("ID món ăn không hợp lệ trong new_items");
      }
      if (!item.quantity || item.quantity < 1) {
        throw new Error("Số lượng phải là số dương");
      }
      const itemExists = await Item.findById(item.id).session(session);
      if (!itemExists) {
        throw new Error(`Không tìm thấy món ăn với ID ${item.id}`);
      }
      if (item.size) {
        const validSize = itemExists.sizes.find(s => s.name === item.size);
        if (!validSize) {
          throw new Error(`Kích cỡ ${item.size} không hợp lệ cho món ${itemExists.name}`);
        }
      }
      const itemKey = `${item.id}-${item.size || 'default'}`;
      newQuantities[itemKey] = (newQuantities[itemKey] || 0) + item.quantity;
    }

    for (const itemKey in newQuantities) {
      const [itemId, size] = itemKey.split('-');
      const original = originalQuantities[itemId];
      if (!original || (size !== 'default' && original.size !== size) || newQuantities[itemKey] > original.quantity) {
        throw new Error("Món ăn mới vượt quá số lượng gốc hoặc kích cỡ không khớp");
      }
    }

    const newOrder = await orderService.createOrder({
      customer_id: originalOrder.customer_id,
      time: originalOrder.time,
      type: originalOrder.type,
      status: originalOrder.status,
    }, { session });

    const newItemOrders = new_items.map(item => ({
      item_id: new mongoose.Types.ObjectId(item.id),
      quantity: item.quantity,
      order_id: newOrder._id,
      size: item.size || null,
      note: item.note || "",
    }));
    await orderService.createItemOrders(newItemOrders, { session });

    const remainingItems = {};
    originalItemOrders.forEach(item => {
      const itemKey = `${item.item_id}-${item.size || 'default'}`;
      const newQty = newQuantities[itemKey] || 0;
      if (item.quantity > newQty) {
        remainingItems[itemKey] = {
          item_id: item.item_id,
          quantity: item.quantity - newQty,
          size: item.size,
          note: item.note,
        };
      }
    });

    await ItemOrder.deleteMany({ order_id: originalOrder._id }).session(session);
    const updatedItemOrders = Object.values(remainingItems).map(item => ({
      item_id: item.item_id,
      quantity: item.quantity,
      order_id: originalOrder._id,
      size: item.size,
      note: item.note,
    }));
    await orderService.createItemOrders(updatedItemOrders, { session });

    const reservedTables = await ReservedTable.find({ reservation_id: originalOrder._id }).lean();
    const tableNumbers = reservedTables.map(rt => rt.table_id);
    const tablesInfo = await TableInfo.find({ table_number: { $in: tableNumbers } }).lean();
    const tablesWithStatus = tablesInfo.map(table => ({
      table_number: table.table_number,
      capacity: table.capacity,
      status: originalOrder.status === 'pending' ? 'Reserved' : 'Occupied',
      start_time: reservedTables.find(rt => rt.table_id === table.table_number)?.start_time || null,
      end_time: reservedTables.find(rt => rt.table_id === table.table_number)?.end_time || null,
    }));

    await session.commitTransaction();

    return res.status(200).json({
      status: "SUCCESS",
      message: "Tách đơn hàng thành công!",
      data: {
        originalOrder: {
          id: originalOrder._id,
          items: updatedItemOrders.map(item => ({
            item_id: item.item_id,
            quantity: item.quantity,
            size: item.size,
            note: item.note,
          })),
          tables: tablesWithStatus,
        },
        newOrder: {
          id: newOrder._id,
          items: newItemOrders.map(item => ({
            item_id: item.item_id,
            quantity: item.quantity,
            size: item.size,
            note: item.note,
          })),
          tables: [],
        },
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Lỗi khi tách đơn hàng:", error);
    return res.status(500).json({
      status: "ERROR",
      message: error.message || "Đã xảy ra lỗi khi tách đơn hàng!",
      data: null,
    });
  } finally {
    session.endSession();
  }
};

const mergeOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { source_table_number, target_table_number, source_order_id, target_order_id } = req.body;

    const hasTableNumbers = source_table_number !== undefined && target_table_number !== undefined;
    const hasOrderIds = source_order_id !== undefined && target_order_id !== undefined;

    if (!hasTableNumbers && !hasOrderIds) {
      throw new Error("Must provide either source_table_number and target_table_number or source_order_id and target_order_id");
    }
    if (hasTableNumbers && hasOrderIds) {
      throw new Error("Cannot provide both table numbers and order IDs");
    }

    let sourceOrder, targetOrder;

    if (hasTableNumbers) {
      if (!source_table_number || isNaN(source_table_number)) {
        throw new Error("source_table_number must be a valid number");
      }
      if (!target_table_number || isNaN(target_table_number)) {
        throw new Error("target_table_number must be a valid number");
      }
      if (source_table_number === target_table_number) {
        throw new Error("Source and target tables must be different");
      }

      const [sourceReservedTable, targetReservedTable] = await Promise.all([
        ReservedTable.findOne({
          table_id: source_table_number,
          start_time: { $lte: new Date() },
          end_time: { $gte: new Date() },
        }).session(session),
        ReservedTable.findOne({
          table_id: target_table_number,
          start_time: { $lte: new Date() },
          end_time: { $gte: new Date() },
        }).session(session),
      ]);

      if (!sourceReservedTable) {
        throw new Error(`No active order found for source table ${source_table_number}`);
      }
      if (!targetReservedTable) {
        throw new Error(`No active order found for target table ${target_table_number}`);
      }

      [sourceOrder, targetOrder] = await Promise.all([
        OrderDetail.findById(sourceReservedTable.reservation_id).session(session),
        OrderDetail.findById(targetReservedTable.reservation_id).session(session),
      ]);

      if (!sourceOrder) {
        throw new Error("Source order not found");
      }
      if (!targetOrder) {
        throw new Error("Target order not found");
      }
    } else if (hasOrderIds) {
      if (!mongoose.Types.ObjectId.isValid(source_order_id)) {
        throw new Error("source_order_id must be a valid ObjectId");
      }
      if (!mongoose.Types.ObjectId.isValid(target_order_id)) {
        throw new Error("target_order_id must be a valid ObjectId");
      }
      if (source_order_id === target_order_id) {
        throw new Error("Source and target orders must be different");
      }

      [sourceOrder, targetOrder] = await Promise.all([
        OrderDetail.findById(source_order_id).session(session),
        OrderDetail.findById(target_order_id).session(session),
      ]);

      if (!sourceOrder) {
        throw new Error("Source order not found");
      }
      if (!targetOrder) {
        throw new Error("Target order not found");
      }
    }

    if (!['pending', 'confirmed'].includes(sourceOrder.status)) {
      throw new Error("Can only merge orders in pending or confirmed status");
    }
    if (!['pending', 'confirmed'].includes(targetOrder.status)) {
      throw new Error("Can only merge into orders in pending or confirmed status");
    }

    const [sourceItemOrders, targetItemOrders] = await Promise.all([
      ItemOrder.find({ order_id: sourceOrder._id }).session(session),
      ItemOrder.find({ order_id: targetOrder._id }).session(session),
    ]);

    const itemMap = new Map();

    for (const item of targetItemOrders) {
      const key = `${item.item_id}-${item.size || 'default'}`;
      itemMap.set(key, {
        item_id: item.item_id,
        quantity: item.quantity,
        size: item.size,
        note: item.note || '',
      });
    }

    for (const item of sourceItemOrders) {
      const key = `${item.item_id}-${item.size || 'default'}`;
      if (itemMap.has(key)) {
        itemMap.get(key).quantity += item.quantity;
        if (item.note && item.note !== itemMap.get(key).note) {
          itemMap.get(key).note = `${itemMap.get(key).note ? itemMap.get(key).note + '; ' : ''}${item.note}`;
        }
      } else {
        itemMap.set(key, {
          item_id: item.item_id,
          quantity: item.quantity,
          size: item.size,
          note: item.note || '',
        });
      }
    }

    await ItemOrder.deleteMany({ order_id: targetOrder._id }).session(session);
    const newItemOrders = Array.from(itemMap.values()).map(item => ({
      item_id: item.item_id,
      quantity: item.quantity,
      order_id: targetOrder._id,
      size: item.size,
      note: item.note,
    }));
    await orderService.createItemOrders(newItemOrders, { session });

    await ReservedTable.updateMany(
      { reservation_id: sourceOrder._id },
      { reservation_id: targetOrder._id },
      { session }
    );

    await Promise.all([
      ItemOrder.deleteMany({ order_id: sourceOrder._id }).session(session),
      ReservedTable.deleteMany({ reservation_id: sourceOrder._id }).session(session),
      OrderDetail.findByIdAndDelete(sourceOrder._id).session(session),
    ]);

    await session.commitTransaction();

    const user = await getUserByUserId(targetOrder.customer_id);
    await emailService.sendOrderConfirmationEmail(user.email, user.name, targetOrder);

    const enrichedItemOrders = await Promise.all(
      newItemOrders.map(async (itemOrder) => {
        const item = await Item.findById(itemOrder.item_id);
        const sizeInfo = item && itemOrder.size && item.sizes
          ? item.sizes.find(s => s.name === itemOrder.size)
          : null;
        return {
          item_id: itemOrder.item_id,
          quantity: itemOrder.quantity,
          size: itemOrder.size,
          note: itemOrder.note,
          itemName: item ? item.name : null,
          itemImage: item ? item.image : null,
          itemPrice: sizeInfo ? sizeInfo.price : (item ? item.price : null),
        };
      })
    );

    const reservedTables = await ReservedTable.find({ reservation_id: targetOrder._id }).lean();
    const tableNumbers = reservedTables.map(rt => rt.table_id);
    const tablesInfo = await TableInfo.find({ table_number: { $in: tableNumbers } }).lean();
    const tablesWithStatus = tablesInfo.map(table => ({
      table_number: table.table_number,
      capacity: table.capacity,
      status: targetOrder.status === 'pending' ? 'Reserved' : 'Occupied',
      start_time: reservedTables.find(rt => rt.table_id === table.table_number)?.start_time || null,
      end_time: reservedTables.find(rt => rt.table_id === table.table_number)?.end_time || null,
    }));

    return res.status(200).json({
      status: "SUCCESS",
      message: "Orders merged successfully!",
      data: {
        order: {
          id: targetOrder._id,
          customer_id: targetOrder.customer_id,
          staff_id: targetOrder.staff_id,
          time: targetOrder.time,
          type: targetOrder.type,
          status: targetOrder.status,
          items: enrichedItemOrders,
          tables: tablesWithStatus,
        },
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error merging order:", error);
    return res.status(500).json({
      status: "ERROR",
      message: error.message || "An error occurred while merging the order!",
      data: null,
    });
  } finally {
    session.endSession();
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
  confirmOrder,
  splitOrder,
  mergeOrder,
};
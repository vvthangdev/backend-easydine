const OrderDetail = require("../models/order_detail.model");
const orderService = require("../services/order.service");
const ReservedTable = require("../models/reservation_table.model");
const TableInfo = require("../models/table_info.model");
const ItemOrder = require("../models/item_order.model");
const Item = require("../models/item.model");
const Voucher = require("../models/voucher.model");
const CanceledItemOrder = require("../models/canceled_item_order.model");
const emailService = require("../services/send-email.service");
const { getUserByUserId } = require("../services/user.service");
const { getIO, getAdminSockets } = require("../socket");
const socketOrderService = require("../socket/services/order");
const { calculateOrderTotal } = require("../services/voucher.service");
const moment = require("moment");
const qs = require("qs");

const crypto = require("crypto");
const mongoose = require("mongoose");

async function updateOrderAmounts(orderId, session) {
  try {
    const total_amount = await calculateOrderTotal(orderId, { session });
    let discount_amount = 0;
    let final_amount = total_amount;

    const order = await OrderDetail.findById(orderId).session(session);
    if (order.voucher_id) {
      const voucher = await mongoose
        .model("Voucher")
        .findById(order.voucher_id)
        .session(session);
      if (!voucher) throw new Error("Voucher not found!");
      if (voucher.discountType === "percentage") {
        discount_amount = (voucher.discount / 100) * total_amount;
      } else {
        discount_amount = voucher.discount;
      }
      final_amount = total_amount - discount_amount;
      if (final_amount < 0) throw new Error("Final amount cannot be negative!");
    }

    await OrderDetail.findByIdAndUpdate(
      orderId,
      { total_amount, discount_amount, final_amount, updated_at: new Date() },
      { session }
    );
  } catch (error) {
    console.error(
      `Error updating amounts for order ${orderId}:`,
      error.message
    );
    throw error;
  }
}

const createOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { start_time, end_time, tables, items, ...orderData } = req.body;

    if (!start_time || !end_time) {
      return res.status(400).json({
        status: "ERROR",
        message: "start_time and end_time are required!",
        data: null,
      });
    }
    if (orderData.type === "reservation" && (!tables || tables.length === 0)) {
      return res.status(400).json({
        status: "ERROR",
        message: "At least one table is required for reservation!",
        data: null,
      });
    }

    if (orderData.type === "reservation") {
      for (const tableId of tables) {
        if (!mongoose.Types.ObjectId.isValid(tableId)) {
          throw new Error("Invalid table_id!");
        }
      }
    }

    const newOrderData = {
      customer_id: req.user._id,
      time: new Date(start_time),
      ...orderData,
    };
    if (orderData.status === "confirmed") {
      newOrderData.staff_id = req.user._id;
    }

    const newOrder = await orderService.createOrder(newOrderData, { session });

    if (orderData.type === "reservation") {
      const startTime = new Date(start_time);
      const endTime = new Date(end_time);

      const tableInfos = await TableInfo.find({ _id: { $in: tables } }).session(
        session
      );
      if (tableInfos.length !== tables.length) {
        throw new Error("One or more table_ids not found!");
      }

      const unavailableTables = await orderService.checkUnavailableTables(
        startTime,
        endTime,
        tables
      );
      if (unavailableTables.length > 0) {
        throw new Error("Some selected tables are not available!");
      }

      const reservedTables = tables.map((tableId) => ({
        reservation_id: newOrder._id,
        table_id: new mongoose.Types.ObjectId(tableId),
        start_time: startTime,
        end_time: endTime,
      }));
      await orderService.createReservations(reservedTables, { session });
    }

    if (items && items.length > 0) {
      const itemIds = items.map((item) => new mongoose.Types.ObjectId(item.id));
      const foundItems = await Item.find({ _id: { $in: itemIds } }).session(
        session
      );
      const itemMap = new Map(
        foundItems.map((item) => [item._id.toString(), item])
      );

      for (const item of items) {
        if (!item.id || !mongoose.Types.ObjectId.isValid(item.id)) {
          throw new Error("Invalid item ID!");
        }
        if (!item.quantity || item.quantity < 1) {
          throw new Error("Quantity must be a positive number!");
        }
        const itemExists = itemMap.get(item.id);
        if (!itemExists) {
          throw new Error(`Item with ID ${item.id} not found!`);
        }
        if (item.size) {
          const validSize = itemExists.sizes.find((s) => s.name === item.size);
          if (!validSize) {
            throw new Error(
              `Invalid size ${item.size} for item ${itemExists.name}!`
            );
          }
        }
      }

      const itemOrders = items.map((item) => ({
        item_id: new mongoose.Types.ObjectId(item.id),
        quantity: item.quantity,
        order_id: newOrder._id,
        size: item.size || null,
        note: item.note || "",
      }));
      await orderService.createItemOrders(itemOrders, { session });
    }

    await session.commitTransaction();

    const response = {
      status: "SUCCESS",
      message: "Order created successfully!",
      data: newOrder,
    };

    // Gửi thông báo Socket.IO đến admin
    setImmediate(() => {
      socketOrderService.notifyNewOrder(newOrder, req.user);
    });

    // Gửi email xác nhận
    setImmediate(async () => {
      try {
        const user = await getUserByUserId(req.user._id);
        await emailService.sendOrderConfirmationEmail(
          user.email,
          user.name,
          newOrder
        );
      } catch (emailError) {
        console.error("Error sending email:", emailError.message);
      }
    });

    return res.status(201).json(response);
  } catch (error) {
    await session.abortTransaction();
    return res.status(500).json({
      status: "ERROR",
      message: error.message || "An error occurred while creating the order!",
      data: null,
    });
  } finally {
    session.endSession();
  }
};

const updateOrder = async (req, res) => {
  const session = await mongoose.startSession({
    defaultTransactionOptions: {
      readConcern: { level: "snapshot" },
      writeConcern: { w: "majority" },
    },
  });
  session.startTransaction();
  try {
    const { id, start_time, end_time, tables, items, ...otherFields } =
      req.body;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: "ERROR",
        message: "Valid order ID is required!",
        data: null,
      });
    }

    const order = await OrderDetail.findById(id).session(session);
    if (!order) {
      return res.status(404).json({
        status: "ERROR",
        message: "Order not found!",
        data: null,
      });
    }

    const updateData = { ...otherFields };
    if (start_time) updateData.time = new Date(start_time);

    if (order.status === "pending" && otherFields.status === "confirmed") {
      if (!req.user._id) {
        throw new Error("Staff ID is required to confirm order!");
      }
      updateData.staff_id = req.user._id;
    }

    if (
      ["completed", "canceled"].includes(otherFields.status) &&
      order.type === "reservation"
    ) {
      const currentTime = new Date();
      await ReservedTable.updateMany(
        { reservation_id: id },
        { end_time: currentTime },
        { session }
      );
    }

    const updatedOrder = await orderService.updateOrder(id, updateData, {
      session,
    });
    if (!updatedOrder) {
      return res.status(404).json({
        status: "ERROR",
        message: "Order not found!",
        data: null,
      });
    }

    if (order.type === "reservation" && tables !== undefined) {
      if (tables.length > 0) {
        if (!start_time || !end_time) {
          return res.status(400).json({
            status: "ERROR",
            message:
              "start_time and end_time are required when updating tables!",
            data: null,
          });
        }

        for (const tableId of tables) {
          if (!mongoose.Types.ObjectId.isValid(tableId)) {
            throw new Error("Invalid table_id!");
          }
        }

        const startTime = new Date(start_time);
        const endTime = new Date(end_time);

        const tableInfos = await TableInfo.find({
          _id: { $in: tables },
        }).session(session);
        if (tableInfos.length !== tables.length) {
          throw new Error("One or more table_ids not found!");
        }

        const unavailableTables = await orderService.checkUnavailableTables(
          startTime,
          endTime,
          tables,
          id
        );
        if (unavailableTables.length > 0) {
          return res.status(400).json({
            status: "ERROR",
            message: "Some selected tables are not available!",
            data: { unavailable: unavailableTables },
          });
        }

        await ReservedTable.deleteMany({ reservation_id: id }).session(session);
        const newReservations = tables.map((tableId) => ({
          reservation_id: id,
          table_id: new mongoose.Types.ObjectId(tableId),
          start_time: startTime,
          end_time: endTime,
        }));
        await orderService.createReservations(newReservations, { session });
      } else {
        await ReservedTable.deleteMany({ reservation_id: id }).session(session);
      }
    }

    if (items !== undefined) {
      await ItemOrder.deleteMany({ order_id: id }).session(session);

      if (items.length > 0) {
        const itemIds = items.map(
          (item) => new mongoose.Types.ObjectId(item.id)
        );
        const foundItems = await Item.find({ _id: { $in: itemIds } }).session(
          session
        );
        const itemMap = new Map(
          foundItems.map((item) => [item._id.toString(), item])
        );

        for (const item of items) {
          if (!item.id || !mongoose.Types.ObjectId.isValid(item.id)) {
            throw new Error("Invalid item ID!");
          }
          if (!item.quantity || item.quantity < 1) {
            throw new Error("Quantity must be a positive number!");
          }
          const itemExists = itemMap.get(item.id);
          if (!itemExists) {
            throw new Error(`Item with ID ${item.id} not found!`);
          }
          if (item.size) {
            const validSize = itemExists.sizes.find(
              (s) => s.name === item.size
            );
            if (!validSize) {
              throw new Error(
                `Invalid size ${item.size} for item ${itemExists.name}!`
              );
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
        await orderService.createItemOrders(newItemOrders, { session });
      }
    }

    await session.commitTransaction();

    const response = {
      status: "SUCCESS",
      message: "Order updated successfully!",
      data: updatedOrder,
    };

    if (otherFields.status) {
      setImmediate(async () => {
        try {
          const { io, adminSockets } = require("../app");
          const notification = {
            orderId: updatedOrder._id.toString(),
            customerId: updatedOrder.customer_id.toString(),
            type: updatedOrder.type,
            status: updatedOrder.status,
            staffId: updatedOrder.staff_id?.toString() || null,
            time: updatedOrder.time.toISOString(),
            createdAt: new Date().toISOString(),
            message: `Order ${updatedOrder._id} updated to status ${updatedOrder.status}`,
          };

          adminSockets.forEach((socket) => {
            socket.emit("orderStatusUpdate", notification);
          });
        } catch (error) {
          console.error("Error sending notification:", error.message);
        }
      });
    }

    return res.status(200).json(response);
  } catch (error) {
    await session.abortTransaction();
    return res.status(500).json({
      status: "ERROR",
      message: error.message || "An error occurred while updating the order!",
      data: null,
    });
  } finally {
    session.endSession();
  }
};

const getOrderInfo = async (req, res) => {
  try {
    const { id, table_id } = req.query;

    // Kiểm tra đầu vào
    if (!id && !table_id) {
      return res.status(400).json({
        status: "ERROR",
        message: "Either order ID or table_id is required!",
        data: null,
      });
    }
    if (id && table_id) {
      return res.status(400).json({
        status: "ERROR",
        message: "Please provide either order ID or table_id, not both!",
        data: null,
      });
    }

    let order;

    // Tìm đơn hàng theo ID
    if (id) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          status: "ERROR",
          message: "Invalid order ID!",
          data: null,
        });
      }
      order = await OrderDetail.findById(id)
        .populate("voucher_id", "code") // Populate chỉ lấy trường code
        .lean();
    }
    // Tìm đơn hàng theo table_id
    else if (table_id) {
      if (!mongoose.Types.ObjectId.isValid(table_id)) {
        return res.status(400).json({
          status: "ERROR",
          message: "Invalid table_id!",
          data: null,
        });
      }

      const currentTime = new Date();
      const reservedTable = await ReservedTable.findOne({
        table_id: new mongoose.Types.ObjectId(table_id),
        start_time: { $lte: currentTime },
        end_time: { $gte: currentTime },
      }).lean();

      if (!reservedTable) {
        return res.status(404).json({
          status: "ERROR",
          message: `No active order found for table_id ${table_id} at current UTC time (${currentTime.toISOString()})!`,
          data: null,
        });
      }

      order = await OrderDetail.findById(reservedTable.reservation_id)
        .populate("voucher_id", "code")
        .lean();
    }

    if (!order) {
      return res.status(404).json({
        status: "ERROR",
        message: "Order not found!",
        data: null,
      });
    }

    // Lấy thông tin bàn
    const reservedTables = await ReservedTable.find({
      reservation_id: order._id,
    }).lean();
    const tableIds = reservedTables.map((rt) => rt.table_id);
    const tablesInfo = await TableInfo.find({ _id: { $in: tableIds } }).lean();
    const enrichedTables = tablesInfo.map((table) => ({
      table_id: table._id,
      table_number: table.table_number,
      area: table.area,
      capacity: table.capacity,
      status: order.status === "pending" ? "Reserved" : "Occupied",
      start_time:
        reservedTables.find((rt) => rt.table_id.equals(table._id))
          ?.start_time || null,
      end_time:
        reservedTables.find((rt) => rt.table_id.equals(table._id))?.end_time ||
        null,
    }));

    // Lấy thông tin món ăn
    const itemOrders = await ItemOrder.find({ order_id: order._id }).lean();
    const enrichedItemOrders = await Promise.all(
      itemOrders.map(async (itemOrder) => {
        const item = await Item.findById(itemOrder.item_id).lean();
        const sizeInfo =
          item && itemOrder.size && item.sizes
            ? item.sizes.find((s) => s.name === itemOrder.size)
            : null;
        return {
          _id: itemOrder._id,
          item_id: itemOrder.item_id,
          quantity: itemOrder.quantity,
          order_id: itemOrder.order_id,
          size: itemOrder.size,
          note: itemOrder.note,
          itemName: item ? item.name : null,
          itemImage: item ? item.image : null,
          itemPrice: sizeInfo ? sizeInfo.price : item ? item.price : null,
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
          voucher_code: order.voucher_id ? order.voucher_id.code : null, // Trả về code thay vì voucher_id
          total_amount: order.total_amount,
          discount_amount: order.discount_amount,
          final_amount: order.final_amount,
        },
        reservedTables: enrichedTables,
        itemOrders: enrichedItemOrders,
      },
    });
  } catch (error) {
    console.error("Error in getOrderInfo:", error);
    return res.status(500).json({
      status: "ERROR",
      message: error.message || "An error occurred while fetching order info!",
      data: null,
    });
  }
};

const getAllOrders = async (req, res) => {
  try {
    const orderDetail = await OrderDetail.find({});

    return res.status(200).json({
      status: "SUCCESS",
      message: "Orders retrieved successfully!",
      data: orderDetail,
    });
  } catch (error) {
    return res.status(500).json({
      status: "ERROR",
      message: "An error occurred while fetching orders!",
      data: null,
    });
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
          if (item) {
            const sizeInfo =
              itemOrder.size && item.sizes
                ? item.sizes.find((s) => s.name === itemOrder.size)
                : null;
            totalAmount +=
              (sizeInfo ? sizeInfo.price : item.price) * itemOrder.quantity;
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
    return res.status(500).json({
      status: "ERROR",
      message: "An error occurred while fetching user orders!",
      data: null,
    });
  }
};

const searchOrdersByCustomerId = async (req, res) => {
  try {
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

    const orders = await OrderDetail.find({
      customer_id: new mongoose.Types.ObjectId(customer_id),
    });

    return res.status(200).json({
      status: "SUCCESS",
      message: "Orders retrieved successfully!",
      data: orders,
    });
  } catch (error) {
    return res.status(500).json({
      status: "ERROR",
      message: "An error occurred while searching orders!",
      data: null,
    });
  }
};

const deleteOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: "ERROR",
        message: "Valid order ID is required!",
        data: null,
      });
    }

    const order = await OrderDetail.findById(id).session(session);
    if (!order) {
      return res.status(404).json({
        status: "ERROR",
        message: "Order not found!",
        data: null,
      });
    }

    await Promise.all([
      ReservedTable.deleteMany({ reservation_id: id }).session(session),
      ItemOrder.deleteMany({ order_id: id }).session(session),
      OrderDetail.findByIdAndDelete(id).session(session),
    ]);

    await session.commitTransaction();

    return res.status(200).json({
      status: "SUCCESS",
      message: "Order deleted successfully!",
      data: null,
    });
  } catch (error) {
    await session.abortTransaction();
    return res.status(500).json({
      status: "ERROR",
      message: "An error occurred while deleting the order!",
      data: null,
    });
  } finally {
    session.endSession();
  }
};

const splitOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { order_id, new_items } = req.body;

    if (!order_id || !mongoose.Types.ObjectId.isValid(order_id)) {
      throw new Error("order_id phải là một ObjectId hợp lệ");
    }
    if (!new_items || !Array.isArray(new_items) || new_items.length === 0) {
      throw new Error("new_items phải là một mảng không rỗng");
    }

    const originalOrder = await OrderDetail.findById(order_id).session(session);
    if (!originalOrder) {
      throw new Error("Không tìm thấy đơn hàng gốc");
    }
    if (!["pending", "confirmed"].includes(originalOrder.status)) {
      throw new Error(
        "Chỉ có thể tách đơn hàng ở trạng thái pending hoặc confirmed"
      );
    }

    const originalItemOrders = await ItemOrder.find({
      order_id: originalOrder._id,
    }).lean();
    if (!originalItemOrders.length) {
      throw new Error("Không tìm thấy món ăn trong đơn hàng gốc");
    }

    const originalQuantities = {};
    originalItemOrders.forEach((item) => {
      const key = `${item.item_id}-${item.size || "default"}`;
      originalQuantities[key] = {
        item_id: item.item_id,
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
        const validSize = itemExists.sizes.find((s) => s.name === item.size);
        if (!validSize) {
          throw new Error(
            `Kích cỡ ${item.size} không hợp lệ cho món ${itemExists.name}`
          );
        }
      }
      const itemKey = `${item.id}-${item.size || "default"}`;
      newQuantities[itemKey] = (newQuantities[itemKey] || 0) + item.quantity;
    }

    for (const itemKey in newQuantities) {
      const [itemId, size] = itemKey.split("-");
      const original = originalQuantities[`${itemId}-${size}`];
      if (!original || newQuantities[itemKey] > original.quantity) {
        throw new Error(
          "Món ăn mới vượt quá số lượng gốc hoặc kích cỡ không khớp"
        );
      }
    }

    const newOrder = await orderService.createOrder(
      {
        customer_id: originalOrder.customer_id,
        time: originalOrder.time,
        type: originalOrder.type,
        status: originalOrder.status,
      },
      { session }
    );

    const newItemOrders = new_items.map((item) => ({
      item_id: new mongoose.Types.ObjectId(item.id),
      quantity: item.quantity,
      order_id: newOrder._id,
      size: item.size || null,
      note: item.note || "",
    }));
    await orderService.createItemOrders(newItemOrders, { session });

    const remainingItems = {};
    originalItemOrders.forEach((item) => {
      const itemKey = `${item.item_id}-${item.size || "default"}`;
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

    await ItemOrder.deleteMany({ order_id: originalOrder._id }).session(
      session
    );
    const updatedItemOrders = Object.values(remainingItems).map((item) => ({
      item_id: item.item_id,
      quantity: item.quantity,
      order_id: originalOrder._id,
      size: item.size,
      note: item.note,
    }));
    await orderService.createItemOrders(updatedItemOrders, { session });

    const reservedTables = await ReservedTable.find({
      reservation_id: originalOrder._id,
    }).lean();
    const tableIds = reservedTables.map((rt) => rt.table_id);
    const tablesInfo = await TableInfo.find({ _id: { $in: tableIds } }).lean();
    const tablesWithStatus = tablesInfo.map((table) => ({
      table_id: table._id,
      table_number: table.table_number,
      area: table.area,
      capacity: table.capacity,
      status: originalOrder.status === "pending" ? "Reserved" : "Occupied",
      start_time:
        reservedTables.find((rt) => rt.table_id.equals(table._id))
          ?.start_time || null,
      end_time:
        reservedTables.find((rt) => rt.table_id.equals(table._id))?.end_time ||
        null,
    }));

    await session.commitTransaction();

    return res.status(200).json({
      status: "SUCCESS",
      message: "Tách đơn hàng thành công!",
      data: {
        originalOrder: {
          id: originalOrder._id,
          items: updatedItemOrders.map((item) => ({
            item_id: item.item_id,
            quantity: item.quantity,
            size: item.size,
            note: item.note,
          })),
          tables: tablesWithStatus,
        },
        newOrder: {
          id: newOrder._id,
          items: newItemOrders.map((item) => ({
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
    const { source_order_id, target_order_id } = req.body;

    // Kiểm tra đầu vào
    if (!source_order_id || !mongoose.Types.ObjectId.isValid(source_order_id)) {
      throw new Error("source_order_id phải là một ObjectId hợp lệ");
    }
    if (!target_order_id || !mongoose.Types.ObjectId.isValid(target_order_id)) {
      throw new Error("target_order_id phải là một ObjectId hợp lệ");
    }
    if (source_order_id === target_order_id) {
      throw new Error("Đơn hàng nguồn và đích phải khác nhau");
    }

    // Lấy thông tin đơn hàng
    const sourceOrder = await OrderDetail.findById(source_order_id).session(
      session
    );
    const targetOrder = await OrderDetail.findById(target_order_id).session(
      session
    );

    if (!sourceOrder) {
      throw new Error("Không tìm thấy đơn hàng nguồn");
    }
    if (!targetOrder) {
      throw new Error("Không tìm thấy đơn hàng đích");
    }

    // Kiểm tra trạng thái và type
    if (!["pending", "confirmed"].includes(sourceOrder.status)) {
      throw new Error(
        "Chỉ có thể gộp đơn hàng ở trạng thái pending hoặc confirmed"
      );
    }
    if (!["pending", "confirmed"].includes(targetOrder.status)) {
      throw new Error(
        "Chỉ có thể gộp vào đơn hàng ở trạng thái pending hoặc confirmed"
      );
    }
    if (sourceOrder.type !== targetOrder.type) {
      throw new Error("Đơn hàng nguồn và đích phải có cùng type");
    }

    // Lấy danh sách món ăn
    const sourceItemOrders = await ItemOrder.find({
      order_id: sourceOrder._id,
    }).session(session);
    const targetItemOrders = await ItemOrder.find({
      order_id: targetOrder._id,
    }).session(session);

    // Gộp món ăn
    const itemMap = new Map();
    for (const item of targetItemOrders) {
      const key = `${item.item_id}-${item.size || "default"}`;
      itemMap.set(key, {
        item_id: item.item_id,
        quantity: item.quantity,
        size: item.size,
        note: item.note || "",
      });
    }

    for (const item of sourceItemOrders) {
      const key = `${item.item_id}-${item.size || "default"}`;
      if (itemMap.has(key)) {
        itemMap.get(key).quantity += item.quantity;
        if (item.note && item.note !== itemMap.get(key).note) {
          itemMap.get(key).note = `${
            itemMap.get(key).note ? itemMap.get(key).note + "; " : ""
          }${item.note}`;
        }
      } else {
        itemMap.set(key, {
          item_id: item.item_id,
          quantity: item.quantity,
          size: item.size,
          note: item.note || "",
        });
      }
    }

    // Xóa món ăn cũ của đơn đích
    await ItemOrder.deleteMany({ order_id: targetOrder._id }).session(session);

    // Tạo mới món ăn cho đơn đích
    const newItemOrders = Array.from(itemMap.values()).map((item) => ({
      item_id: item.item_id,
      quantity: item.quantity,
      order_id: targetOrder._id,
      size: item.size,
      note: item.note,
    }));
    await orderService.createItemOrders(newItemOrders, { session });

    // Chuyển bàn từ đơn nguồn sang đơn đích
    if (sourceOrder.type === "reservation") {
      await ReservedTable.updateMany(
        { reservation_id: sourceOrder._id },
        { reservation_id: targetOrder._id },
        { session }
      );
    }

    // Xóa đơn nguồn và các bản ghi liên quan
    await ItemOrder.deleteMany({ order_id: sourceOrder._id }).session(session);
    await ReservedTable.deleteMany({ reservation_id: sourceOrder._id }).session(
      session
    );
    await OrderDetail.deleteOne({ _id: sourceOrder._id }, { session });

    // Cập nhật thời gian đơn đích
    targetOrder.updated_at = new Date();
    await targetOrder.save({ session });

    // Cam kết transaction
    await session.commitTransaction();

    // Lấy thông tin chi tiết cho response (sau transaction)
    const enrichedItemOrders = await Promise.all(
      newItemOrders.map(async (itemOrder) => {
        const item = await Item.findById(itemOrder.item_id); // Không cần session
        const sizeInfo =
          item && itemOrder.size && item.sizes
            ? item.sizes.find((s) => s.name === itemOrder.size)
            : null;
        return {
          item_id: itemOrder.item_id,
          quantity: itemOrder.quantity,
          size: itemOrder.size,
          note: itemOrder.note,
          itemName: item ? item.name : null,
          itemImage: item ? item.image : null,
          itemPrice: sizeInfo ? sizeInfo.price : item ? item.price : null,
        };
      })
    );

    const reservedTables = await ReservedTable.find({
      reservation_id: targetOrder._id,
    }).lean();
    const tableIds = reservedTables.map((rt) => rt.table_id);
    const tablesInfo = await TableInfo.find({ _id: { $in: tableIds } }).lean();
    const tablesWithStatus = tablesInfo.map((table) => ({
      table_id: table._id,
      table_number: table.table_number,
      area: table.area,
      capacity: table.capacity,
      status: targetOrder.status === "pending" ? "Reserved" : "Occupied",
      start_time:
        reservedTables.find((rt) => rt.table_id.equals(table._id))
          ?.start_time || null,
      end_time:
        reservedTables.find((rt) => rt.table_id.equals(table._id))?.end_time ||
        null,
    }));

    // Chuẩn bị response
    const response = {
      status: "SUCCESS",
      message: "Gộp đơn hàng thành công!",
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
    };

    // Gửi thông báo Socket.IO bất đồng bộ
    setImmediate(async () => {
      try {
        const { io, adminSockets } = require("../app");
        const notification = {
          orderId: target_order_id,
          sourceOrderId: source_order_id,
          customerId: targetOrder.customer_id.toString(),
          type: targetOrder.type,
          status: targetOrder.status,
          staffId: req.user?._id?.toString() || null,
          time: targetOrder.time.toISOString(),
          createdAt: new Date().toISOString(),
          message: `Order ${source_order_id} merged into ${target_order_id}`,
        };

        adminSockets.forEach((socket) => {
          socket.emit("orderStatusUpdate", notification);
        });
      } catch (error) {
        console.error("Error sending notification:", error.message);
      }
    });

    // Gửi email bất đồng bộ
    setImmediate(async () => {
      try {
        const user = await getUserByUserId(targetOrder.customer_id);
        await emailService.sendOrderConfirmationEmail(
          user.email,
          user.name,
          targetOrder
        );
      } catch (emailError) {
        console.error("Error sending email:", emailError.message);
      }
    });

    return res.status(200).json(response);
  } catch (error) {
    await session.abortTransaction();
    return res.status(500).json({
      status: "ERROR",
      message: error.message || "Đã xảy ra lỗi khi gộp đơn hàng!",
      data: null,
    });
  } finally {
    session.endSession();
  }
};

function sortObject(obj) {
  let sorted = {};
  let str = [];
  let key;
  for (key in obj) {
    if (obj.hasOwnProperty(key)) {
      str.push(encodeURIComponent(key));
    }
  }
  str.sort();
  for (key = 0; key < str.length; key++) {
    sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, "+");
  }
  return sorted;
}

const createPayment = async (req, res) => {
  try {
    const { order_id, bank_code, language, txtexpire } = req.body;

    // Kiểm tra đầu vào
    if (!order_id || !mongoose.Types.ObjectId.isValid(order_id)) {
      return res.status(400).json({
        status: "ERROR",
        message: "Valid order_id is required!",
        data: null,
      });
    }

    // Kiểm tra cấu hình VNPAY
    const vnp_TmnCode = process.env.VNPAY_TMN_CODE;
    const vnp_HashSecret = process.env.VNPAY_HASH_SECRET;
    if (!vnp_TmnCode || !vnp_HashSecret) {
      throw new Error("VNPAY configuration is missing");
    }

    // Kiểm tra đơn hàng
    const order = await mongoose.model("OrderDetail").findById(order_id);
    if (!order) {
      return res.status(404).json({
        status: "ERROR",
        message: "Order not found!",
        data: null,
      });
    }
    if (order.status !== "confirmed") {
      return res.status(400).json({
        status: "ERROR",
        message: "Only confirmed orders can proceed to payment!",
        data: null,
      });
    }
    if (order.payment_status === "success") {
      return res.status(400).json({
        status: "ERROR",
        message: "Order has already been paid!",
        data: null,
      });
    }

    // Tính total_amount từ ItemOrder (giả sử có hàm này)
    const total_amount = await calculateOrderTotal(order_id);
    if (total_amount <= 0) {
      return res.status(400).json({
        status: "ERROR",
        message: "Order has no valid items or total amount is zero!",
        data: null,
      });
    }

    let discount_amount = 0;
    let final_amount = total_amount;

    // Xử lý voucher
    if (order.voucher_id) {
      const voucher = await mongoose
        .model("Voucher")
        .findById(order.voucher_id);
      if (!voucher) {
        return res.status(400).json({
          status: "ERROR",
          message: "Voucher not found!",
          data: null,
        });
      }
      if (voucher.discountType === "percentage") {
        discount_amount = (voucher.discount / 100) * total_amount;
      } else {
        discount_amount = voucher.discount;
      }
      final_amount = total_amount - discount_amount;
      if (final_amount < 0) {
        return res.status(400).json({
          status: "ERROR",
          message: "Final amount cannot be negative!",
          data: null,
        });
      }
    }

    // Cập nhật OrderDetail
    await mongoose.model("OrderDetail").findByIdAndUpdate(order_id, {
      total_amount,
      discount_amount,
      final_amount,
      payment_method: "vnpay",
    });

    // Cấu hình VNPay
    process.env.TZ = "Asia/Ho_Chi_Minh";
    const vnp_Url =
      process.env.VNPAY_URL ||
      "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
    const vnp_ReturnUrl =
      process.env.VNPAY_RETURN_URL || "http://localhost:3000/payment-return";
    const vnp_CreateDate = moment(new Date()).format("YYYYMMDDHHmmss");
    const vnp_TxnRef = order_id;
    const vnp_Amount = final_amount * 100; // VNPay yêu cầu nhân 100
    const vnp_IpAddr = req.headers["x-forwarded-for"] || req.ip || "127.0.0.1";
    const vnp_Locale = language || "vn";
    const vnp_CurrCode = "VND";
    const vnp_OrderInfo = `Thanh toan don hang ${order_id}`.replace(
      /[^a-zA-Z0-9 ]/g,
      ""
    );
    const vnp_OrderType = "other";
    const vnp_ExpireDate =
      txtexpire ||
      moment(new Date()).add(30, "minutes").format("YYYYMMDDHHmmss"); // Tăng lên 30 phút

    // Lưu thông tin giao dịch
    await mongoose.model("OrderDetail").findByIdAndUpdate(order_id, {
      transaction_id: vnp_TxnRef,
      payment_initiated_at: new Date(),
    });

    // Tạo params
    let vnp_Params = {
      vnp_Version: "2.1.0",
      vnp_Command: "pay",
      vnp_TmnCode,
      vnp_Amount,
      vnp_CurrCode,
      vnp_TxnRef,
      vnp_OrderInfo,
      vnp_OrderType,
      vnp_Locale,
      vnp_ReturnUrl,
      vnp_IpAddr,
      vnp_CreateDate,
      vnp_ExpireDate,
    };

    if (bank_code && ["VNPAYQR", "VNBANK", "INTCARD"].includes(bank_code)) {
      vnp_Params.vnp_BankCode = bank_code;
    }

    // Sắp xếp và tạo chữ ký
    vnp_Params = sortObject(vnp_Params);
    const signData = qs.stringify(vnp_Params, { encode: false });
    const hmac = crypto.createHmac("sha512", vnp_HashSecret);
    const vnp_SecureHash = hmac
      .update(Buffer.from(signData, "utf-8"))
      .digest("hex");
    vnp_Params.vnp_SecureHash = vnp_SecureHash;

    // Tạo URL
    const vnpUrl = `${vnp_Url}?${qs.stringify(vnp_Params, { encode: false })}`;

    console.log(
      `Creating payment for order ${order_id}: signData=${signData}, vnp_SecureHash=${vnp_SecureHash}`
    );
    return res.status(200).json({
      status: "SUCCESS",
      message: "Payment URL created successfully!",
      data: { vnpUrl },
    });
  } catch (error) {
    console.error("Error in createPayment:", error);
    return res.status(500).json({
      status: "ERROR",
      message: error.message || "An error occurred while creating payment!",
      data: null,
    });
  }
};

const handlePaymentReturn = async (req, res) => {
  try {
    let vnp_Params = req.query;
    const vnp_SecureHash = vnp_Params.vnp_SecureHash;
    delete vnp_Params.vnp_SecureHash;
    delete vnp_Params.vnp_SecureHashType;

    // Sắp xếp và tạo chữ ký
    vnp_Params = sortObject(vnp_Params);
    const signData = qs.stringify(vnp_Params, { encode: false });
    const hmac = crypto.createHmac("sha512", process.env.VNPAY_HASH_SECRET);
    const calculatedHash = hmac
      .update(Buffer.from(signData, "utf-8"))
      .digest("hex");

    console.log(`Return signData: ${signData}`);
    console.log(`Return vnp_SecureHash: ${vnp_SecureHash}`);
    console.log(`Return calculatedHash: ${calculatedHash}`);

    const order_id = vnp_Params.vnp_TxnRef;
    const vnp_ResponseCode = vnp_Params.vnp_ResponseCode;

    // Kiểm tra đơn hàng
    const order = await mongoose.model("OrderDetail").findById(order_id);
    if (!order) {
      return res.redirect(
        `${
          process.env.FRONTEND_URL
        }/payment-failed?message=${encodeURIComponent("Order not found")}`
      );
    }

    // Kiểm tra chữ ký
    if (calculatedHash !== vnp_SecureHash) {
      return res.redirect(
        `${
          process.env.FRONTEND_URL
        }/payment-failed?message=${encodeURIComponent(
          "Sai chữ ký (Checksum failed)"
        )}`
      );
    }

    // Thông báo kết quả
    const errorMessages = {
      "00": "Giao dịch thành công",
      "07": "Giao dịch bị nghi ngờ gian lận",
      "09": "Thẻ/Tài khoản chưa đăng ký Internet Banking",
      10: "Xác thực thẻ/tài khoản không đúng quá 3 lần",
      11: "Hết hạn chờ thanh toán",
      12: "Thẻ/Tài khoản bị khóa",
      13: "Sai OTP",
      24: "Khách hàng hủy giao dịch",
      51: "Tài khoản không đủ số dư",
      65: "Vượt hạn mức giao dịch trong ngày",
      75: "Ngân hàng đang bảo trì",
      79: "Sai mật khẩu thanh toán quá số lần",
      97: "Sai chữ ký",
      99: "Lỗi không xác định",
    };

    const message =
      errorMessages[vnp_ResponseCode] ||
      `Giao dịch thất bại với mã ${vnp_ResponseCode}`;
    if (vnp_ResponseCode === "00") {
      return res.redirect(
        `${
          process.env.FRONTEND_URL
        }/payment-success?order_id=${order_id}&message=${encodeURIComponent(
          message
        )}`
      );
    } else {
      return res.redirect(
        `${
          process.env.FRONTEND_URL
        }/payment-failed?message=${encodeURIComponent(message)}`
      );
    }
  } catch (error) {
    console.error(
      `Error in handlePaymentReturn for order ${req.query.vnp_TxnRef}:`,
      error
    );
    return res.redirect(
      `${process.env.FRONTEND_URL}/payment-failed?message=${encodeURIComponent(
        "Error processing payment"
      )}`
    );
  }
};

const handlePaymentIPN = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    console.log(
      "Starting IPN processing for request:",
      JSON.stringify(req.query)
    );
    let vnp_Params = req.query;
    const vnp_SecureHash = vnp_Params.vnp_SecureHash;
    const order_id = vnp_Params.vnp_TxnRef;
    const vnp_Amount = parseInt(vnp_Params.vnp_Amount) / 100;
    const vnp_ResponseCode = vnp_Params.vnp_ResponseCode;
    const vnp_TransactionStatus = vnp_Params.vnp_TransactionStatus;
    const vnp_TransactionNo = vnp_Params.vnp_TransactionNo;

    console.log(
      `Extracted parameters: order_id=${order_id}, amount=${vnp_Amount}, responseCode=${vnp_ResponseCode}, transactionStatus=${vnp_TransactionStatus}, transactionNo=${vnp_TransactionNo}`
    );

    delete vnp_Params.vnp_SecureHash;
    delete vnp_Params.vnp_SecureHashType;

    // Sắp xếp và tạo chữ ký
    vnp_Params = sortObject(vnp_Params);
    const signData = qs.stringify(vnp_Params, { encode: false });
    const hmac = crypto.createHmac("sha512", process.env.VNPAY_HASH_SECRET);
    const calculatedHash = hmac
      .update(Buffer.from(signData, "utf-8"))
      .digest("hex");

    console.log(`IPN signData: ${signData}`);
    console.log(`IPN vnp_SecureHash: ${vnp_SecureHash}`);
    console.log(`IPN calculatedHash: ${calculatedHash}`);

    // Kiểm tra chữ ký
    if (calculatedHash !== vnp_SecureHash) {
      console.error(
        `Invalid signature for IPN, order ${order_id}. Expected: ${calculatedHash}, Received: ${vnp_SecureHash}`
      );
      await session.abortTransaction();
      return res
        .status(200)
        .json({ RspCode: "97", Message: "Checksum failed" });
    }
    console.log(`Signature verification passed for order ${order_id}`);

    // Kiểm tra đơn hàng
    const order = await mongoose
      .model("OrderDetail")
      .findById(order_id)
      .session(session);
    if (!order) {
      console.error(`Order not found for IPN, order ${order_id}`);
      await session.abortTransaction();
      return res
        .status(200)
        .json({ RspCode: "01", Message: "Order not found" });
    }
    console.log(`Order found: ${JSON.stringify(order)}`);

    // Kiểm tra số tiền
    if (order.final_amount !== vnp_Amount) {
      console.error(
        `Invalid amount for IPN, order ${order_id}: expected ${order.final_amount}, got ${vnp_Amount}`
      );
      await session.abortTransaction();
      return res.status(200).json({ RspCode: "04", Message: "Invalid amount" });
    }
    console.log(`Amount verification passed for order ${order_id}`);

    // Kiểm tra trạng thái
    if (order.payment_status === "success" || order.status === "completed") {
      console.log(
        `Order already processed for IPN, order ${order_id}, payment_status=${order.payment_status}, status=${order.status}`
      );
      await session.abortTransaction();
      return res
        .status(200)
        .json({ RspCode: "02", Message: "Order already confirmed" });
    }
    console.log(`Order status check passed for order ${order_id}`);

    // Cập nhật trạng thái
    if (vnp_ResponseCode === "00" && vnp_TransactionStatus === "00") {
      console.log(`Processing successful payment for order ${order_id}`);
      await mongoose.model("OrderDetail").findByIdAndUpdate(
        order_id,
        {
          status: "completed",
          payment_status: "success",
          vnp_transaction_no: vnp_TransactionNo,
        },
        { session }
      );

      if (order.voucher_id) {
        console.log(
          `Updating voucher usage for voucher_id ${order.voucher_id}`
        );
        await mongoose
          .model("Voucher")
          .findByIdAndUpdate(
            order.voucher_id,
            { $inc: { usedCount: 1 } },
            { session }
          );
      }
    } else {
      console.log(
        `Processing failed payment for order ${order_id}, responseCode=${vnp_ResponseCode}, transactionStatus=${vnp_TransactionStatus}`
      );
      await mongoose.model("OrderDetail").findByIdAndUpdate(
        order_id,
        {
          payment_status: "failed",
          vnp_transaction_no: vnp_TransactionNo,
        },
        { session }
      );
    }

    await session.commitTransaction();
    console.log(
      `IPN processed successfully for order ${order_id}, responseCode=${vnp_ResponseCode}, transactionNo=${vnp_TransactionNo}`
    );
    return res.status(200).json({ RspCode: "00", Message: "Success" });
  } catch (error) {
    console.error(
      `Error in handlePaymentIPN for order ${req.query.vnp_TxnRef}: ${error.message}`,
      {
        stack: error.stack,
        params: req.query,
      }
    );
    await session.abortTransaction();
    return res.status(200).json({ RspCode: "99", Message: "Unknown error" });
  } finally {
    console.log(
      `Ending session for IPN processing, order ${req.query.vnp_TxnRef}`
    );
    session.endSession();
  }
};

const addItemsToOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { order_id, items } = req.body;

    // Kiểm tra đầu vào
    if (!order_id || !mongoose.Types.ObjectId.isValid(order_id)) {
      return res.status(400).json({
        status: "ERROR",
        message: "Valid order_id is required!",
        data: null,
      });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        status: "ERROR",
        message: "Items must be a non-empty array!",
        data: null,
      });
    }

    // Kiểm tra đơn hàng
    const order = await OrderDetail.findById(order_id).session(session);
    if (!order) {
      return res.status(404).json({
        status: "ERROR",
        message: "Order not found!",
        data: null,
      });
    }
    if (!["pending", "confirmed"].includes(order.status)) {
      return res.status(400).json({
        status: "ERROR",
        message: "Items can only be added to pending or confirmed orders!",
        data: null,
      });
    }
    if (order.payment_status === "success") {
      return res.status(400).json({
        status: "ERROR",
        message: "Cannot modify items in a paid order!",
        data: null,
      });
    }

    // Kiểm tra món ăn
    const itemIds = items.map((item) => new mongoose.Types.ObjectId(item.id));
    const foundItems = await Item.find({ _id: { $in: itemIds } }).session(
      session
    );
    const itemMap = new Map(
      foundItems.map((item) => [item._id.toString(), item])
    );

    for (const item of items) {
      if (!item.id || !mongoose.Types.ObjectId.isValid(item.id)) {
        throw new Error(`Invalid item ID: ${item.id}`);
      }
      if (!item.quantity || item.quantity < 1) {
        throw new Error("Quantity must be a positive number!");
      }
      const itemExists = itemMap.get(item.id);
      if (!itemExists) {
        throw new Error(`Item with ID ${item.id} not found!`);
      }
      if (item.size) {
        const validSize = itemExists.sizes.find((s) => s.name === item.size);
        if (!validSize) {
          throw new Error(
            `Invalid size ${item.size} for item ${itemExists.name}!`
          );
        }
      }
    }

    // Lấy danh sách món hiện có
    const existingItemOrders = await ItemOrder.find({
      order_id: order._id,
    }).session(session);
    const itemOrderMap = new Map(
      existingItemOrders.map((io) => [`${io.item_id}-${io.size || ""}`, io])
    );

    const newItemOrders = [];
    const updatedItemOrders = [];

    // Xử lý từng món trong request
    for (const item of items) {
      const key = `${item.id}-${item.size || ""}`;
      const existingItemOrder = itemOrderMap.get(key);

      if (existingItemOrder) {
        updatedItemOrders.push({
          ...existingItemOrder.toObject(),
          quantity: existingItemOrder.quantity + item.quantity,
          note: item.note || existingItemOrder.note || "",
        });
        itemOrderMap.delete(key);
      } else {
        newItemOrders.push({
          item_id: new mongoose.Types.ObjectId(item.id),
          quantity: item.quantity,
          order_id: order._id,
          size: item.size || null,
          note: item.note || "",
        });
      }
    }

    // Giữ các món không bị ảnh hưởng
    itemOrderMap.forEach((io) => updatedItemOrders.push(io.toObject()));

    // Xóa các món cũ và tạo lại
    await ItemOrder.deleteMany({ order_id: order._id }).session(session);
    if (updatedItemOrders.length > 0 || newItemOrders.length > 0) {
      await orderService.createItemOrders(
        updatedItemOrders.concat(newItemOrders),
        { session }
      );
    }

    // Cập nhật thời gian đơn hàng
    order.updated_at = new Date();
    await order.save({ session });

    await session.commitTransaction();

    // Lấy thông tin chi tiết món để trả về
    const allItemOrders = await ItemOrder.find({ order_id: order._id }).session(
      null
    );
    const enrichedItems = await Promise.all(
      allItemOrders.map(async (itemOrder) => {
        const item =
          itemMap.get(itemOrder.item_id.toString()) ||
          (await Item.findById(itemOrder.item_id));
        const sizeInfo =
          itemOrder.size && item.sizes
            ? item.sizes.find((s) => s.name === itemOrder.size)
            : null;
        return {
          _id: itemOrder._id,
          item_id: itemOrder.item_id,
          quantity: itemOrder.quantity,
          size: itemOrder.size,
          note: itemOrder.note,
          itemName: item.name,
          itemImage: item.image,
          itemPrice: sizeInfo ? sizeInfo.price : item.price,
        };
      })
    );


    const user = req.user;
    
    setImmediate(() => {
      socketOrderService.notifyOrderItemsUpdate(order, allItemOrders, user);
    });

    setImmediate(async () => {
      const newSession = await mongoose.startSession();
      newSession.startTransaction();
      try {
        await updateOrderAmounts(order._id, newSession);
        await newSession.commitTransaction();
      } catch (error) {
        await newSession.abortTransaction();
        console.error("Error updating order amounts:", error.message);
      } finally {
        newSession.endSession();
      }
    });

    
    return res.status(200).json({
      status: "SUCCESS",
      message: "Items added to order successfully!",
      data: {
        order_id: order._id,
        items: enrichedItems,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    return res.status(500).json({
      status: "ERROR",
      message:
        error.message || "An error occurred while adding items to order!",
      data: null,
    });
  } finally {
    session.endSession();
  }
};

const cancelItems = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { order_id, items } = req.body;

    // Kiểm tra đầu vào
    if (!order_id || !mongoose.Types.ObjectId.isValid(order_id)) {
      return res.status(400).json({
        status: "ERROR",
        message: "Valid order_id is required!",
        data: null,
      });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        status: "ERROR",
        message: "Items must be a non-empty array!",
        data: null,
      });
    }

    // Kiểm tra đơn hàng
    const order = await OrderDetail.findById(order_id).session(session);
    if (!order) {
      return res.status(404).json({
        status: "ERROR",
        message: "Order not found!",
        data: null,
      });
    }
    if (!["pending", "confirmed"].includes(order.status)) {
      return res.status(400).json({
        status: "ERROR",
        message: "Items can only be canceled from pending or confirmed orders!",
        data: null,
      });
    }
    if (order.payment_status === "success") {
      return res.status(400).json({
        status: "ERROR",
        message: "Cannot cancel items in a paid order!",
        data: null,
      });
    }

    // Kiểm tra món ăn
    const itemIds = items.map(
      (item) => new mongoose.Types.ObjectId(item.item_id)
    );
    const foundItems = await Item.find({ _id: { $in: itemIds } }).session(
      session
    );
    const itemMap = new Map(
      foundItems.map((item) => [item._id.toString(), item])
    );

    const existingItemOrders = await ItemOrder.find({
      order_id: order._id,
    }).session(session);
    const itemOrderMap = new Map(
      existingItemOrders.map((io) => [`${io.item_id}-${io.size || ""}`, io])
    );

    const canceledItemOrders = [];
    const updatedItemOrders = [];

    for (const item of items) {
      if (!item.item_id || !mongoose.Types.ObjectId.isValid(item.item_id)) {
        throw new Error(`Invalid item ID: ${item.item_id}`);
      }
      if (!item.quantity || item.quantity < 1) {
        throw new Error("Quantity must be a positive number!");
      }
      const itemExists = itemMap.get(item.item_id);
      if (!itemExists) {
        throw new Error(`Item with ID ${item.item_id} not found!`);
      }
      if (item.size) {
        const validSize = itemExists.sizes.find((s) => s.name === item.size);
        if (!validSize) {
          throw new Error(
            `Invalid size ${item.size} for item ${itemExists.name}!`
          );
        }
      }

      const key = `${item.item_id}-${item.size || ""}`;
      const existingItemOrder = itemOrderMap.get(key);
      if (!existingItemOrder) {
        throw new Error(
          `Item ${itemExists.name} (size: ${
            item.size || "default"
          }) not found in order!`
        );
      }
      if (item.quantity > existingItemOrder.quantity) {
        throw new Error(
          `Cancel quantity (${item.quantity}) exceeds ordered quantity (${existingItemOrder.quantity}) for item ${itemExists.name}!`
        );
      }

      // Lưu món hủy
      canceledItemOrders.push({
        item_id: new mongoose.Types.ObjectId(item.item_id),
        quantity: item.quantity,
        order_id: order._id,
        size: item.size || null,
        note: existingItemOrder.note || "",
        cancel_reason: item.cancel_reason || "User request",
        canceled_by: req.user._id,
      });

      // Cập nhật số lượng món còn lại
      const remainingQuantity = existingItemOrder.quantity - item.quantity;
      if (remainingQuantity > 0) {
        updatedItemOrders.push({
          ...existingItemOrder.toObject(),
          quantity: remainingQuantity,
        });
      }
      itemOrderMap.delete(key);
    }

    // Giữ các món không bị ảnh hưởng
    itemOrderMap.forEach((io) => updatedItemOrders.push(io.toObject()));

    // Xóa các món cũ và tạo lại
    await ItemOrder.deleteMany({ order_id: order._id }).session(session);
    if (updatedItemOrders.length > 0) {
      await orderService.createItemOrders(updatedItemOrders, { session });
    }

    // Lưu các món đã hủy
    const createdCanceledItems = await CanceledItemOrder.insertMany(
      canceledItemOrders,
      { session }
    );

    // Cập nhật thời gian đơn hàng
    order.updated_at = new Date();
    await order.save({ session });

    await session.commitTransaction();

    // Lấy thông tin chi tiết món hủy
    const enrichedCanceledItems = await Promise.all(
      createdCanceledItems.map(async (itemOrder) => {
        const item =
          itemMap.get(itemOrder.item_id.toString()) ||
          (await Item.findById(itemOrder.item_id));
        const sizeInfo =
          itemOrder.size && item.sizes
            ? item.sizes.find((s) => s.name === itemOrder.size)
            : null;
        return {
          _id: itemOrder._id,
          item_id: itemOrder.item_id,
          quantity: itemOrder.quantity,
          size: itemOrder.size,
          note: itemOrder.note,
          cancel_reason: itemOrder.cancel_reason,
          canceled_by: itemOrder.canceled_by,
          canceled_at: itemOrder.canceled_at,
          itemName: item.name,
          itemImage: item.image,
          itemPrice: sizeInfo ? sizeInfo.price : item.price,
        };
      })
    );

    // Lấy danh sách món còn lại
    const remainingItemOrders = await ItemOrder.find({
      order_id: order._id,
    }).session(null);
    const enrichedRemainingItems = await Promise.all(
      remainingItemOrders.map(async (itemOrder) => {
        const item =
          itemMap.get(itemOrder.item_id.toString()) ||
          (await Item.findById(itemOrder.item_id));
        const sizeInfo =
          itemOrder.size && item.sizes
            ? item.sizes.find((s) => s.name === itemOrder.size)
            : null;
        return {
          _id: itemOrder._id,
          item_id: itemOrder.item_id,
          quantity: itemOrder.quantity,
          size: itemOrder.size,
          note: itemOrder.note,
          itemName: item.name,
          itemImage: item.image,
          itemPrice: sizeInfo ? sizeInfo.price : item.price,
        };
      })
    );

    // Gửi thông báo Socket.IO
    setImmediate(async () => {
      try {
        const { io, adminSockets } = require("../app");
        const notification = {
          orderId: order._id.toString(),
          customerId: order.customer_id.toString(),
          type: order.type,
          status: order.status,
          staffId: req.user?._id?.toString() || null,
          time: order.time.toISOString(),
          createdAt: new Date().toISOString(),
          message: `Items canceled in order ${order._id}: ${items
            .map(
              (i) =>
                `${i.quantity} x ${itemMap.get(i.item_id)?.name || i.item_id}${
                  i.size ? ` (${i.size})` : ""
                }`
            )
            .join(", ")}`,
          canceledItems: enrichedCanceledItems,
          remainingItems: enrichedRemainingItems,
        };
        adminSockets.forEach((socket) => {
          socket.emit("orderItemsUpdate", notification);
        });
      } catch (error) {
        console.error("Error sending notification:", error.message);
      }
    });

    setImmediate(async () => {
      const newSession = await mongoose.startSession();
      newSession.startTransaction();
      try {
        await updateOrderAmounts(order._id, newSession);
        await newSession.commitTransaction();
      } catch (error) {
        await newSession.abortTransaction();
        console.error("Error updating order amounts:", error.message);
      } finally {
        newSession.endSession();
      }
    });

    return res.status(200).json({
      status: "SUCCESS",
      message: "Items canceled successfully!",
      data: {
        order_id: order._id,
        canceledItems: enrichedCanceledItems,
        remainingItems: enrichedRemainingItems,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    return res.status(500).json({
      status: "ERROR",
      message: error.message || "An error occurred while canceling items!",
      data: null,
    });
  } finally {
    session.endSession();
  }
};

const socket = require("../socket.js");

const testNewOrder = async (req, res) => {
  try {
    const io = socket.getIO();
    const notification = {
      orderId: "test123",
      message: "Test new order",
    };

    io.emit("admintest", notification);

    res.json({
      status: "SUCCESS",
      message: "Thông báo gửi thành công",
      data: notification,
    });
  } catch (error) {
    res.status(500).json({
      status: "ERROR",
      message: error.message,
    });
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
  splitOrder,
  mergeOrder,
  createPayment,
  handlePaymentReturn,
  handlePaymentIPN,
  addItemsToOrder,
  cancelItems,
  testNewOrder
};

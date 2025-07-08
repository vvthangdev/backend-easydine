const OrderDetail = require("../models/order_detail.model");
const orderService = require("../services/order.service");
const ReservedTable = require("../models/reservation_table.model");
const TableInfo = require("../models/table_info.model");
const ItemOrder = require("../models/item_order.model");
const Item = require("../models/item.model");
const Guest = require("../models/guest.model")
const CanceledItemOrder = require("../models/canceled_item_order.model");
const emailService = require("../services/send-email.service");
const { getUserByUserId } = require("../services/user.service");
const { calculateOrderTotal } = require("../utils/calculateOrder");

const moment = require("moment");
const qs = require("qs");

const socket = require("../socket/socket");
const crypto = require("crypto");
const mongoose = require("mongoose");

const createOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  let orderResponse;

  try {
    const { start_time, tables, items, ...orderData } = req.body;

    // Kiểm tra dữ liệu đầu vào
    if (!start_time) {
      throw new Error("Yêu cầu phải có start_time!");
    }
    if (orderData.type === "reservation" && (!tables || tables.length === 0)) {
      throw new Error("Đặt bàn phải có ít nhất một bàn!");
    }

    // Tính endTime
    const startTime = new Date(start_time);
    const reservationDuration =
      parseInt(process.env.RESERVATION_DURATION_MINUTES) || 240;
    const endTime = new Date(
      startTime.getTime() + reservationDuration * 60 * 1000
    );

    // Kiểm tra tính hợp lệ của table_id
    if (orderData.type === "reservation") {
      for (const tableId of tables) {
        if (!mongoose.Types.ObjectId.isValid(tableId)) {
          throw new Error("table_id không hợp lệ!");
        }
      }
    }

    // Tạo dữ liệu đơn hàng
    const newOrderData = {
      customer_id: req.user._id,
      time: new Date(start_time),
      ...orderData,
    };
    if (orderData.status === "confirmed") {
      newOrderData.staff_id = req.user._id;
    }

    // Tạo đơn hàng
    const newOrder = await orderService.createOrder(newOrderData, { session });

    // Xử lý đặt bàn
    if (orderData.type === "reservation") {
      const tableInfos = await TableInfo.find({ _id: { $in: tables } }).session(
        session
      );
      if (tableInfos.length !== tables.length) {
        throw new Error("Một hoặc nhiều table_id không tồn tại!");
      }

      const unavailableTables = await orderService.checkUnavailableTables(
        startTime,
        endTime,
        tables
      );
      if (unavailableTables.length > 0) {
        throw new Error("Một số bàn đã chọn không khả dụng!");
      }

      const reservedTables = tables.map((tableId) => ({
        reservation_id: newOrder._id,
        table_id: new mongoose.Types.ObjectId(tableId),
        start_time: startTime,
        end_time: endTime,
      }));
      await orderService.createReservations(reservedTables, { session });
    }

    // Xử lý items
    if (items && items.length > 0) {
      const itemIds = items.map((item) => new mongoose.Types.ObjectId(item.id));
      const foundItems = await Item.find({ _id: { $in: itemIds } }).session(
        session
      );
      const itemMap = new Map(
        foundItems.map((item) => [item.id.toString(), item])
      );

      for (const item of items) {
        if (!item.id || !mongoose.Types.ObjectId.isValid(item.id)) {
          throw new Error("ID mục hàng không hợp lệ!");
        }
        if (!item.quantity || item.quantity < 1) {
          throw new Error("Số lượng phải là số dương!");
        }
        const itemExists = itemMap.get(item.id);
        if (!itemExists) {
          throw new Error(`Mục hàng với ID ${item.id} không tồn tại!`);
        }
        if (item.size) {
          const validSize = itemExists.sizes.find((s) => s.name === item.size);
          if (!validSize) {
            throw new Error(
              `Kích thước ${item.size} không hợp lệ cho mục hàng mục ${itemExists.name}!`
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

    // Cập nhật số tiền
    await orderService.updateOrderAmounts(newOrder._id, session);

    // Chuẩn bị orderResponse
    orderResponse = newOrder.toObject();
    if (orderData.type === "reservation") {
      orderResponse.tables = tables;
      const tableInfos = await TableInfo.find({ _id: { $in: tables } })
        .select("table_number area")
        .lean()
        .session(session);
      orderResponse.tableDetails = tableInfos;
    }

    // Xác nhận giao dịch
    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    return res.status(500).json({
      status: "ERROR",
      message: error.message || "Đã xảy ra lỗi khi tạo đơn hàng!",
      data: null,
    });
  } finally {
    session.endSession();
  }

  // Thực hiện các thao tác không liên quan đến giao dịch
  try {
    // Gửi thông báo Socket.IO
    try {
      // Gửi thông báo Socket.IO
      const io = socket.getIO();
      const notification = {
        id: `notif_${Date.now()}`,
        type: "CREATE_ORDER",
        title: "Đơn hàng mới được tạo",
        message:
          orderResponse.type === "reservation" &&
          orderResponse.tableDetails?.length
            ? `Đơn hàng mới được tạo cho bàn ${
                orderResponse.tableDetails[0].table_number || "N/A"
              } (${orderResponse.tableDetails[0].area || "N/A"})`
            : `Đơn hàng mới được tạo (${
                orderResponse.type === "takeaway" ? "Mang đi" : "Tại chỗ"
              })`,
        data: {
          orderId: orderResponse._id.toString(),
        },
        timestamp: new Date().toISOString(),
        action: {
          label: "Xem chi tiết",
          type: "VIEW_DETAILS",
          payload: { orderId: orderResponse._id.toString() },
        },
      };
      io.to("adminRoom").emit("notification", notification);
      console.log(
        `[Socket.IO] Emitted CREATE_ORDER notification: ${JSON.stringify(
          notification,
          null,
          2
        )}`
      );
    } catch (error) {
      console.error("Lỗi gửi thông báo Socket.IO:", error.message);
      // Tiếp tục xử lý, không làm gián đoạn phản hồi
    }
    // Gửi email xác nhận
    setImmediate(async () => {
      try {
        const user = await getUserByUserId(req.user._id);
        await emailService.sendOrderConfirmationEmail(
          user.email,
          user.name,
          orderResponse
        );
      } catch (emailError) {
        console.error("Lỗi gửi email", emailError.message);
      }
    });

    return res.status(201).json({
      status: "SUCCESS",
      message: "Tạo đơn hàng thành công!",
      data: orderResponse,
    });
  } catch (error) {
    // Xử lý lỗi không liên quan đến giao dịch
    return res.status(500).json({
      status: "ERROR",
      message:
        "Đơn hàng đã được tạo nhưng có lỗi trong quá trình xử lý bổ sung: " +
        error.message,
      data: orderResponse,
    });
  }
};

const createTableOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { start_time, tables, items, guest_info, ...orderData } = req.body;

    // Kiểm tra dữ liệu đầu vào
    if (!start_time) {
      return res.status(400).json({
        status: "ERROR",
        message: "Yêu cầu phải có start_time!",
        data: null,
      });
    }
    if (!tables || !Array.isArray(tables) || tables.length === 0) {
      return res.status(400).json({
        status: "ERROR",
        message: "Đặt bàn phải có ít nhất một bàn!",
        data: null,
      });
    }

    // Đặt type mặc định là reservation
    const orderType = "reservation";
    if (orderData.type && orderData.type !== orderType) {
      throw new Error("Loại đơn hàng phải là reservation!");
    }

    // Kiểm tra tính hợp lệ của table_id
    for (const tableId of tables) {
      if (!mongoose.Types.ObjectId.isValid(tableId)) {
        throw new Error("table_id không hợp lệ!");
      }
    }

    // Tính endTime từ start_time và offset từ .env
    const startTime = new Date(start_time);
    const reservationDuration =
      parseInt(process.env.RESERVATION_TABLE_DURATION_MINUTES) || 120;
    const endTime = new Date(
      startTime.getTime() + reservationDuration * 60 * 1000
    );

    // Tạo rating_pin
    const ratingPin = Math.random().toString(36).substring(2, 8); // PIN 6 ký tự

    // Tạo Guest nếu có guest_info
    let guest = null;
    if (guest_info && (guest_info.name || guest_info.phone || guest_info.email)) {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Hết hạn sau 7 ngày
      guest = new Guest({
        name: guest_info.name || null,
        phone: guest_info.phone || null,
        email: guest_info.email || null,
        expires_at: expiresAt,
      });
      await guest.save({ session });
    }

    // Tạo dữ liệu đơn hàng mới
    const newOrderData = {
      customer_id: null,
      guest_id: guest ? guest._id : null, // Liên kết guest_id nếu có
      time: new Date(start_time),
      type: orderType,
      rating_pin: ratingPin,
      ...orderData,
    };
    if (orderData.status === "confirmed" && req.user?._id) {
      newOrderData.staff_id = req.user._id;
    }

    // Tạo đơn hàng
    const newOrder = await orderService.createOrder(newOrderData, { session });

    const tableInfos = await TableInfo.find({ _id: { $in: tables } }).session(
      session
    );
    if (tableInfos.length !== tables.length) {
      throw new Error("Một hoặc nhiều table_id không tồn tại!");
    }

    const unavailableTables = await orderService.checkUnavailableTables(
      startTime,
      endTime,
      tables,
      null,
      { session }
    );
    if (unavailableTables.length > 0) {
      throw new Error("Một số bàn đã chọn không khả dụng!");
    }

    const reservedTables = tables.map((tableId) => ({
      reservation_id: newOrder._id,
      table_id: new mongoose.Types.ObjectId(tableId),
      start_time: startTime,
      end_time: endTime,
    }));
    await orderService.createReservations(reservedTables, { session });

    if (items && Array.isArray(items) && items.length > 0) {
      const itemIds = items.map((item) => {
        if (!item.id || !mongoose.Types.ObjectId.isValid(item.id)) {
          throw new Error("ID mục hàng không hợp lệ!");
        }
        return new mongoose.Types.ObjectId(item.id);
      });

      const foundItems = await Item.find({ _id: { $in: itemIds } }).session(
        session
      );
      const itemMap = new Map(
        foundItems.map((item) => [item._id.toString(), item])
      );

      for (const item of items) {
        if (!item.quantity || item.quantity < 1) {
          throw new Error("Số lượng phải là số dương!");
        }
        const itemExists = itemMap.get(item.id);
        if (!itemExists) {
          throw new Error(`Mục hàng với ID ${item.id} không tồn tại!`);
        }
        if (item.size) {
          const validSize = itemExists.sizes.find((s) => s.name === item.size);
          if (!validSize) {
            throw new Error(
              `Kích thước ${item.size} không hợp lệ cho mục hàng ${itemExists.name}!`
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

    await orderService.updateOrderAmounts(newOrder._id, session);

    const orderResponse = newOrder.toObject();
    orderResponse.tables = tables;
    const tableInfosDetails = await TableInfo.find({ _id: { $in: tables } })
      .select("table_number area")
      .lean()
      .session(session);
    orderResponse.tableDetails = tableInfosDetails;
    orderResponse.rating_pin = ratingPin;
    orderResponse.guest_info = guest ? {
      name: guest.name,
      phone: guest.phone,
      email: guest.email,
    } : null;

    // Gửi thông báo qua email/SMS nếu có guest_info
    if (guest && (guest.email || guest.phone)) {
      const notificationMessage = `
        Đơn hàng của bạn đã được tạo thành công! 
        Mã đơn hàng: ${newOrder._id}
        Mã đánh giá: ${ratingPin}
        Thời gian: ${startTime.toLocaleString()}
        Bàn: ${tableInfosDetails.map(t => `Bàn ${t.table_number} (${t.area})`).join(', ')}
      `;
      if (guest.email) {
        await emailService.sendEmail({
          to: guest.email,
          subject: "Xác nhận đơn hàng",
          text: notificationMessage,
        });
      }
      // Giả định có smsService
      // if (guest.phone) {
      //   await smsService.sendSMS(guest.phone, notificationMessage);
      // }
    }

    await session.commitTransaction();

    const response = {
      status: "SUCCESS",
      message: "Tạo đơn hàng bàn thành công!",
      data: orderResponse,
    };

    // Gửi thông báo Socket.IO
    const io = socket.getIO();
    const notification = {
      id: `notif_${Date.now()}`,
      type: "CREATE_ORDER",
      title: "Đơn hàng bàn mới được tạo",
      message: `Đơn hàng mới được tạo cho bàn ${
        orderResponse.tableDetails[0]?.table_number || "N/A"
      } (${orderResponse.tableDetails[0]?.area || "N/A"})`,
      data: {
        orderId: orderResponse._id.toString(),
      },
      timestamp: new Date().toISOString(),
      action: {
        label: "Xem chi tiết",
        type: "VIEW_DETAILS",
        payload: { orderId: orderResponse._id.toString() },
      },
    };
    io.to("adminRoom").emit("notification", notification);
    console.log(
      `[Socket.IO] Emitted CREATE_ORDER notification: ${JSON.stringify(
        notification,
        null,
        2
      )}`
    );

    return res.status(201).json(response);
  } catch (error) {
    await session.abortTransaction();
    return res.status(500).json({
      status: "ERROR",
      message: error.message || "Đã xảy ra lỗi khi tạo đơn hàng bàn!",
      data: null,
    });
  } finally {
    session.endSession();
  }
};

const rateOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { order_id, star, comment, rating_pin } = req.body;
    const user_id = req.user?._id;

    // Validate input
    if (!order_id || !mongoose.Types.ObjectId.isValid(order_id)) {
      return res.status(400).json({
        status: "ERROR",
        message: "Valid order_id is required!",
        data: null,
      });
    }
    if (!star || !Number.isInteger(star) || star < 1 || star > 5) {
      return res.status(400).json({
        status: "ERROR",
        message: "Star must be an integer between 1 and 5!",
        data: null,
      });
    }
    if (comment && (typeof comment !== "string" || comment.length > 255)) {
      return res.status(400).json({
        status: "ERROR",
        message: "Comment must be a string and not exceed 255 characters!",
        data: null,
      });
    }

    // Tìm đơn hàng
    const order = await OrderDetail.findById(order_id).session(session).lean();
    if (!order) {
      return res.status(404).json({
        status: "ERROR",
        message: "Order not found!",
        data: null,
      });
    }

    // Kiểm tra trạng thái
    if (!["pending", "confirmed", "completed"].includes(order.status)) {
      return res.status(400).json({
        status: "ERROR",
        message: "Order cannot be rated in its current status!",
        data: null,
      });
    }

    // Kiểm tra đã đánh giá
    if (order.star !== null || order.comment !== null) {
      return res.status(400).json({
        status: "ERROR",
        message: "Order has already been rated!",
        data: null,
      });
    }

    // Kiểm tra quyền
    if (order.customer_id) {
      if (!user_id || order.customer_id.toString() !== user_id.toString()) {
        return res.status(403).json({
          status: "ERROR",
          message: "You are not authorized to rate this order!",
          data: null,
        });
      }
    } else {
      if (!rating_pin || order.rating_pin !== rating_pin) {
        return res.status(403).json({
          status: "ERROR",
          message: "Invalid rating PIN!",
          data: null,
        });
      }
    }

    // Cập nhật đánh giá
    const updatedOrder = await OrderDetail.findByIdAndUpdate(
      order_id,
      { star, comment: comment || null, updated_at: new Date() },
      { new: true, runValidators: true, session }
    ).lean();

    await session.commitTransaction();

    return res.status(200).json({
      status: "SUCCESS",
      message: "Order rated successfully!",
      data: {
        order_id: updatedOrder._id,
        star: updatedOrder.star,
        comment: updatedOrder.comment,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error in rateOrder:", error);
    return res.status(500).json({
      status: "ERROR",
      message: error.message || "An error occurred while rating the order!",
      data: null,
    });
  } finally {
    session.endSession();
  }
};

const reserveTable = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { start_time, people_assigned, items, ...orderData } = req.body;

    // Kiểm tra dữ liệu đầu vào
    if (!start_time) {
      return res.status(400).json({
        status: "ERROR",
        message: "Yêu cầu phải có start_time!",
        data: null,
      });
    }
    if (!people_assigned || people_assigned < 1) {
      return res.status(400).json({
        status: "ERROR",
        message: "Số người (people_assigned) phải là số dương!",
        data: null,
      });
    }

    // Đặt type mặc định là reservation
    const orderType = "reservation";
    if (orderData.type && orderData.type !== orderType) {
      throw new Error("Loại đơn hàng phải là reservation!");
    }

    // Tính endTime từ start_time và offset từ .env
    const startTime = new Date(start_time);
    const reservationDuration =
      parseInt(process.env.RESERVATION_TABLE_DURATION_MINUTES) || 120;
    const endTime = new Date(
      startTime.getTime() + reservationDuration * 60 * 1000
    );

    // Tìm tất cả các bàn trống
    const availableTables = await TableInfo.find({})
      .sort({ capacity: -1 }) // Sắp xếp theo sức chứa giảm dần để ưu tiên bàn lớn
      .session(session);

    if (availableTables.length === 0) {
      throw new Error("Không có bàn nào khả dụng!");
    }

    // Kiểm tra tính khả dụng của các bàn
    const tableIds = availableTables.map((table) => table._id);
    const unavailableTables = await orderService.checkUnavailableTables(
      startTime,
      endTime,
      tableIds,
      null,
      { session }
    );

    // Lọc các bàn khả dụng
    const availableTableList = availableTables.filter(
      (table) => !unavailableTables.includes(table._id.toString())
    );

    if (availableTableList.length === 0) {
      throw new Error(
        "Không có bàn nào khả dụng trong khoảng thời gian yêu cầu!"
      );
    }

    // Tìm tổ hợp bàn phù hợp với số người
    let remainingPeople = people_assigned;
    const selectedTables = [];
    let totalCapacity = 0;

    for (const table of availableTableList) {
      if (remainingPeople > 0) {
        selectedTables.push(table);
        totalCapacity += table.capacity;
        remainingPeople -= table.capacity;
      } else {
        break;
      }
    }

    // Kiểm tra xem tổng sức chứa có đủ không
    if (totalCapacity < people_assigned) {
      throw new Error("Không đủ bàn để chứa số người yêu cầu!");
    }

    const selectedTableIds = selectedTables.map((table) => table._id);

    // Tạo dữ liệu đơn hàng mới
    const newOrderData = {
      customer_id: req.user ? req.user._id : null,
      time: startTime,
      type: orderType,
      number_people: people_assigned,
      ...orderData,
    };
    if (orderData.status === "confirmed" && req.user?._id) {
      newOrderData.staff_id = req.user._id;
    }

    // Tạo đơn hàng
    const newOrder = await orderService.createOrder(newOrderData, { session });

    // Tạo đặt bàn
    const reservedTables = selectedTableIds.map((tableId) => ({
      reservation_id: newOrder._id,
      table_id: new mongoose.Types.ObjectId(tableId),
      start_time: startTime,
      end_time: endTime,
      people_assigned,
    }));
    await orderService.createReservations(reservedTables, { session });

    // Xử lý các món ăn (items) nếu có
    if (items && Array.isArray(items) && items.length > 0) {
      const itemIds = items.map((item) => {
        if (!item.id || !mongoose.Types.ObjectId.isValid(item.id)) {
          throw new Error("ID mục hàng không hợp lệ!");
        }
        return new mongoose.Types.ObjectId(item.id);
      });

      const foundItems = await Item.find({ _id: { $in: itemIds } }).session(
        session
      );
      const itemMap = new Map(
        foundItems.map((item) => [item._id.toString(), item])
      );

      for (const item of items) {
        if (!item.quantity || item.quantity < 1) {
          throw new Error("Số lượng phải là số dương!");
        }
        const itemExists = itemMap.get(item.id);
        if (!itemExists) {
          throw new Error(`Mục hàng với ID ${item.id} không tồn tại!`);
        }
        if (item.size) {
          const validSize = itemExists.sizes.find((s) => s.name === item.size);
          if (!validSize) {
            throw new Error(
              `Kích thước ${item.size} không hợp lệ cho mục hàng ${itemExists.name}!`
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

    // Cập nhật số tiền đơn hàng
    await orderService.updateOrderAmounts(newOrder._id, session);

    // Chuẩn bị phản hồi
    const orderResponse = newOrder.toObject();
    orderResponse.tables = selectedTableIds;
    const tableInfosDetails = await TableInfo.find({
      _id: { $in: selectedTableIds },
    })
      .select("table_number area capacity")
      .lean()
      .session(session);
    orderResponse.tableDetails = tableInfosDetails;
    orderResponse.items = items || []; // Thêm danh sách món ăn vào phản hồi

    // Hoàn tất giao dịch
    await session.commitTransaction();

    // Chuẩn bị phản hồi
    const response = {
      status: "SUCCESS",
      message: "Đặt bàn và món ăn thành công!",
      data: orderResponse,
    };

    // Gửi thông báo Socket.IO
    const io = socket.getIO();
    const notification = {
      id: `notif_${Date.now()}`,
      type: "CREATE_ORDER",
      title: "Đơn hàng đặt bàn mới được tạo",
      message: `Đơn hàng mới được tạo cho bàn ${
        orderResponse.tableDetails[0]?.table_number || "N/A"
      } (${orderResponse.tableDetails[0]?.area || "N/A"})`,
      data: {
        orderId: orderResponse._id.toString(),
      },
      timestamp: new Date().toISOString(),
      action: {
        label: "Xem chi tiết",
        type: "VIEW_DETAILS",
        payload: { orderId: orderResponse._id.toString() },
      },
    };
    io.to("adminRoom").emit("notification", notification);
    console.log(
      `[Socket.IO] Emitted CREATE_ORDER notification: ${JSON.stringify(
        notification,
        null,
        2
      )}`
    );

    // Gửi email xác nhận (nếu có user)
    if (req.user?._id) {
      setImmediate(async () => {
        try {
          const user = await getUserByUserId(req.user._id);
          await emailService.sendOrderConfirmationEmail(
            user.email,
            user.name,
            orderResponse
          );
        } catch (emailError) {
          console.error("Lỗi gửi email:", emailError.message);
        }
      });
    }

    return res.status(201).json(response);
  } catch (error) {
    await session.abortTransaction();
    return res.status(500).json({
      status: "ERROR",
      message: error.message || "Đã xảy ra lỗi khi đặt bàn!",
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
      return res
        .status(400)
        .json({ status: "ERROR", message: "ID đơn hàng sai rồi!", data: null });
    }

    const order = await OrderDetail.findById(id).session(session);
    if (!order) {
      return res.status(404).json({
        status: "ERROR",
        message: "Đơn hàng không tìm thấy!",
        data: null,
      });
    }

    const updateData = { ...otherFields };
    if (start_time) updateData.time = new Date(start_time);

    if (order.status === "pending" && otherFields.status === "confirmed") {
      if (!req.user?._id) throw new Error("Confirm đơn cần ID nhân viên!");
      updateData.staff_id = req.user._id;
    }

    if (
      ["completed", "canceled"].includes(otherFields.status) &&
      order.type === "reservation"
    ) {
      await ReservedTable.updateMany(
        { reservation_id: id },
        { end_time: new Date() },
        { session }
      );
    }

    const updatedOrder = await orderService.updateOrder(id, updateData, {
      session,
    });
    if (!updatedOrder) {
      return res.status(404).json({
        status: "ERROR",
        message: "Update thất bại, đơn không thấy!",
        data: null,
      });
    }

    if (order.type === "reservation" && tables) {
      if (tables.length > 0) {
        if (!start_time) {
          return res.status(400).json({
            status: "ERROR",
            message: "Thiếu start_time để đặt bàn!",
            data: null,
          });
        }

        const startTime = new Date(start_time);
        const defaultEndTime = new Date(
          startTime.getTime() + 4 * 60 * 60 * 1000
        );
        const maxEndTime = new Date(startTime);
        maxEndTime.setHours(23, 59, 0, 0);

        let commonEndTime = end_time
          ? new Date(end_time) < startTime
            ? maxEndTime
            : new Date(
                Math.min(new Date(end_time).getTime(), maxEndTime.getTime())
              )
          : new Date(Math.min(defaultEndTime.getTime(), maxEndTime.getTime()));

        const tableIds = tables.map((table) => table.tableId || table);
        const tableInfos = await TableInfo.find({
          _id: { $in: tableIds },
        }).session(session);
        if (tableInfos.length !== tableIds.length)
          throw new Error("Có bàn không tồn tại!");

        await ReservedTable.deleteMany({ reservation_id: id }).session(session);
        const newReservations = tables.map((table) => ({
          reservation_id: id,
          table_id: new mongoose.Types.ObjectId(table.tableId || table),
          start_time: startTime,
          end_time: table.end_time
            ? new Date(table.end_time) < startTime
              ? maxEndTime
              : new Date(
                  Math.min(
                    new Date(table.end_time).getTime(),
                    maxEndTime.getTime()
                  )
                )
            : commonEndTime,
        }));
        await orderService.createReservations(newReservations, { session });
      } else {
        await ReservedTable.deleteMany({ reservation_id: id }).session(session);
      }
    }

    if (items) {
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
          if (!item.quantity || item.quantity < 1)
            throw new Error("Số lượng món phải lớn hơn 0!");
          const itemExists = itemMap.get(item.id);
          if (!itemExists)
            throw new Error(`Món ${item.id} không có trong menu!`);
          if (
            item.size &&
            !itemExists.sizes.find((s) => s.name === item.size)
          ) {
            throw new Error(
              `Size ${item.size} không hợp lệ cho món ${itemExists.name}!`
            );
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

    return res.status(200).json({
      status: "SUCCESS",
      message: "Cập nhật đơn ngon lành!",
      data: "",
    });
  } catch (error) {
    await session.abortTransaction();
    return res.status(500).json({
      status: "ERROR",
      message: error.message || "Lỗi gì đó khi update đơn, thử lại nha!",
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

    const currentTime = new Date(); // Thời gian UTC

    let orders = [];

    // Tìm đơn hàng theo ID
    if (id) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          status: "ERROR",
          message: "Invalid order ID!",
          data: null,
        });
      }
      const order = await OrderDetail.findById(id)
        .populate("voucher_id", "code")
        .lean();
      if (order) orders.push(order);
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

      // Tìm tất cả đặt bàn hợp lệ
      const reservedTables = await ReservedTable.find({
        table_id: new mongoose.Types.ObjectId(table_id),
        start_time: { $lte: currentTime },
        end_time: { $gte: currentTime },
      }).lean();

      if (!reservedTables.length) {
        return res.status(404).json({
          status: "ERROR",
          message: `No active orders found for table_id ${table_id} at current UTC time (${currentTime.toISOString()})!`,
          data: null,
        });
      }

      // Lấy danh sách reservation_id
      const orderIds = reservedTables.map((rt) => rt.reservation_id);

      // Tìm đơn hàng pending hoặc confirmed
      orders = await OrderDetail.find({
        _id: { $in: orderIds },
        status: { $in: ["pending", "confirmed"] },
      })
        .populate("voucher_id", "code")
        .lean();
    }

    if (!orders.length) {
      return res.status(404).json({
        status: "ERROR",
        message: "No active orders found!",
        data: null,
      });
    }

    // Chỉ lấy đơn hàng đầu tiên (đảm bảo chỉ có 1 đơn pending hoặc confirmed)
    const order = orders[0];

    // Cập nhật giá cho đơn hàng
    // await orderService.updateOrderAmounts(order._id);

    // Lấy thông tin bàn và món ăn cho đơn hàng
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
      people_assigned:
        reservedTables.find((rt) => rt.table_id.equals(table._id))
          ?.people_assigned || null,
    }));

    // Lấy thông tin món ăn
    const itemOrders = await ItemOrder.find({ order_id: order._id }).lean();
    const itemIds = itemOrders.map((io) => io.item_id);
    const items = await Item.find({ _id: { $in: itemIds } }).lean();
    const itemMap = new Map(items.map((item) => [item._id.toString(), item]));
    const enrichedItemOrders = itemOrders.map((itemOrder) => {
      const item = itemMap.get(itemOrder.item_id.toString());
      const sizeInfo =
        item && itemOrder.size
          ? item.sizes.find((s) => s.name === itemOrder.size)
          : null;
      return {
        _id: itemOrder._id,
        item_id: item ? item._id : itemOrder.item_id,
        quantity: itemOrder.quantity,
        order_id: itemOrder.order_id,
        size: itemOrder.size,
        note: itemOrder.note,
        itemName: item ? item.name : null,
        itemImage: item ? item.image : null,
        itemPrice: sizeInfo ? sizeInfo.price : item ? item.price : null,
      };
    });

    const enrichedOrder = {
      order: {
        id: order._id,
        customer_id: order.customer_id,
        staff_id: order.staff_id,
        cashier_id: order.cashier_id,
        time: order.time,
        type: order.type,
        status: order.status,
        number_people: order.number_people,
        voucher_code: order.voucher_id ? order.voucher_id.code : null,
        total_amount: order.total_amount,
        discount_amount: order.discount_amount,
        final_amount: order.final_amount,
        rating_pin: order.rating_pin,
        payment_methods: order.payment_method
          ? [{ method: order.payment_method, amount: order.final_amount }]
          : [],
        payment_status: order.payment_status || "pending",
        star: order.star || null,
        comment: order.comment || null,
        transaction_id: order.transaction_id || null,
        vnp_transaction_no: order.vnp_transaction_no || null,
      },
      reservedTables: enrichedTables,
      itemOrders: enrichedItemOrders,
    };

    return res.status(200).json({
      status: "SUCCESS",
      message: "Order details fetched successfully!",
      data: enrichedOrder, // Trả về một object thay vì mảng
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
    // Lấy tham số page và limit từ query, mặc định page=1, limit=10
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Truy vấn với phân trang
    const orderDetail = await OrderDetail.find({})
      .skip(skip)
      .limit(limit);

    // Đếm tổng số bản ghi để trả về thông tin phân trang
    const total = await OrderDetail.countDocuments();

    return res.status(200).json({
      status: "SUCCESS",
      message: "Orders retrieved successfully!",
      data: orderDetail,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
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

    // Cập nhật giá cho đơn hàng gốc và đơn hàng mới
    await orderService.updateOrderAmounts(originalOrder._id, session);
    await orderService.updateOrderAmounts(newOrder._id, session);

    // Tải lại thông tin đơn hàng để lấy giá trị cập nhật
    const updatedOriginalOrder = await OrderDetail.findById(
      originalOrder._id
    ).session(session);
    const updatedNewOrder = await OrderDetail.findById(newOrder._id).session(
      session
    );

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

    // Cập nhật giá cho đơn hàng đích
    await orderService.updateOrderAmounts(targetOrder._id, session);

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

    setImmediate(async () => {
      const newSession = await mongoose.startSession();
      newSession.startTransaction();
      try {
        await orderService.updateOrderAmounts(targetOrder._id, newSession);
        await newSession.commitTransaction();
      } catch (error) {
        await newSession.abortTransaction();
        console.error("Error updating order amounts:", error.message);
      } finally {
        newSession.endSession();
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
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { order_id, bank_code, language, txtexpire } = req.body;

    // Kiểm tra đầu vào
    if (!order_id || !mongoose.Types.ObjectId.isValid(order_id)) {
      return res.status(400).json({
        status: "ERROR",
        message: "Yêu cầu phải có order_id hợp lệ!",
        data: "",
      });
    }

    // Kiểm tra cấu hình VNPAY
    const vnp_TmnCode = process.env.VNPAY_TMN_CODE;
    const vnp_HashSecret = process.env.VNPAY_HASH_SECRET;
    if (!vnp_TmnCode || !vnp_HashSecret) {
      throw new Error("Cấu hình VNPAY bị thiếu!");
    }

    // Kiểm tra đơn hàng
    const order = await mongoose
      .model("OrderDetail")
      .findById(order_id)
      .session(session);
    if (!order) {
      return res.status(404).json({
        status: "ERROR",
        message: "Không tìm thấy đơn hàng!",
        data: "",
      });
    }
    if (order.status !== "confirmed") {
      return res.status(400).json({
        status: "ERROR",
        message: "Chỉ các đơn hàng đã xác nhận mới có thể thanh toán!",
        data: "",
      });
    }
    if (order.payment_status === "success") {
      return res.status(400).json({
        status: "ERROR",
        message: "Đơn hàng đã được thanh toán!",
        data: "",
      });
    }

    // Cập nhật số tiền đơn hàng bằng updateOrderAmounts
    await orderService.updateOrderAmounts(order_id, session);

    // Cập nhật thông tin đơn hàng
    await mongoose.model("OrderDetail").findByIdAndUpdate(
      order_id,
      {
        cashier_id: req.user._id,
        payment_method: "vnpay",
        transaction_id: order_id,
        payment_initiated_at: new Date(),
      },
      { session }
    );

    // Cấu hình VNPay
    process.env.TZ = "Asia/Ho_Chi_Minh";
    const vnp_Url =
      process.env.VNPAY_URL ||
      "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
    const vnp_ReturnUrl =
      process.env.VNPAY_RETURN_URL || "http://localhost:3000/payment-return";
    const vnp_CreateDate = moment(new Date()).format("YYYYMMDDHHmmss");
    const vnp_TxnRef = order_id;
    const orderData = await mongoose
      .model("OrderDetail")
      .findById(order_id)
      .session(session);
    const vnp_Amount = orderData.final_amount * 100; // VNPay yêu cầu nhân 100
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
      moment(new Date()).add(30, "minutes").format("YYYYMMDDHHmmss");

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

    await session.commitTransaction();
    console.log(`vvt check url v2: ${vnpUrl}`);
    return res.status(200).json({
      status: "SUCCESS",
      message: "Tạo URL thanh toán thành công!",
      data: { vnpUrl },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Lỗi trong createPayment:", error);
    return res.status(500).json({
      status: "ERROR",
      message: error.message || "Đã xảy ra lỗi khi tạo thanh toán!",
      data: "",
    });
  } finally {
    session.endSession();
  }
};

const handlePaymentIPN = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const vnp_Params = req.query;
    const vnp_SecureHash = vnp_Params.vnp_SecureHash;
    const order_id = vnp_Params.vnp_TxnRef;
    const vnp_Amount = parseInt(vnp_Params.vnp_Amount) / 100;
    const vnp_ResponseCode = vnp_Params.vnp_ResponseCode;
    const vnp_TransactionStatus = vnp_Params.vnp_TransactionStatus;
    const vnp_TransactionNo = vnp_Params.vnp_TransactionNo;

    delete vnp_Params.vnp_SecureHash;
    delete vnp_Params.vnp_SecureHashType;

    // Sắp xếp và tạo chữ ký
    const signData = qs.stringify(sortObject(vnp_Params), { encode: false });
    const hmac = crypto.createHmac("sha512", process.env.VNPAY_HASH_SECRET);
    const calculatedHash = hmac
      .update(Buffer.from(signData, "utf-8"))
      .digest("hex");

    // Kiểm tra chữ ký
    if (calculatedHash !== vnp_SecureHash) {
      await session.abortTransaction();
      return res
        .status(200)
        .json({ status: "ERROR", message: "Sai chữ ký!", data: "" });
    }

    // Kiểm tra đơn hàng
    const order = await mongoose
      .model("OrderDetail")
      .findById(order_id)
      .session(session);
    if (!order) {
      await session.abortTransaction();
      return res.status(200).json({
        status: "ERROR",
        message: "Không tìm thấy đơn hàng!",
        data: "",
      });
    }

    // Kiểm tra số tiền
    if (order.final_amount !== vnp_Amount) {
      await session.abortTransaction();
      return res
        .status(200)
        .json({ status: "ERROR", message: "Số tiền không hợp lệ!", data: "" });
    }

    // Kiểm tra trạng thái
    if (order.payment_status === "success" || order.status === "completed") {
      await session.abortTransaction();
      return res.status(200).json({
        status: "ERROR",
        message: "Đơn hàng đã được xử lý!",
        data: "",
      });
    }

    // Cập nhật trạng thái
    if (vnp_ResponseCode === "00" && vnp_TransactionStatus === "00") {
      await mongoose.model("OrderDetail").findByIdAndUpdate(
        order_id,
        {
          status: "completed",
          payment_status: "success",
          vnp_transaction_no: vnp_TransactionNo,
        },
        { session }
      );

      // Cập nhật end_time trong ReservationTable
      const reservation = await ReservedTable.findOne({
        reservation_id: order_id,
      }).session(session);
      if (reservation) {
        const currentTime = new Date();
        const endTime = new Date(currentTime.getTime() - 60 * 1000); // Trừ 1 phút
        await ReservedTable.findOneAndUpdate(
          { reservation_id: order_id },
          { end_time: endTime },
          { session }
        );
      }

      // Cập nhật voucher nếu có
      if (order.voucher_id) {
        await mongoose
          .model("Voucher")
          .findByIdAndUpdate(
            order.voucher_id,
            { $inc: { usedCount: 1 } },
            { session }
          );
      }

      // Gửi thông báo Socket.IO
      const io = socket.getIO();
      io.to("adminRoom").emit("orderPaid", {
        orderId: order_id,
        payment_method: "vnpay",
        status: "completed",
        message: `Đơn hàng ${order_id} đã được thanh toán bằng VNPay`,
      });

      // Gửi email xác nhận thanh toán (không chặn luồng chính)
      setImmediate(async () => {
        try {
          const user = await getUserByUserId(order.customer_id);
          await emailService.sendOrderPaymentConfirmationEmail(
            user.email,
            user.name,
            order
          );
        } catch (emailError) {
          console.error("Lỗi gửi email:", emailError.message);
        }
      });
    } else {
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
    return res
      .status(200)
      .json({ status: "SUCCESS", message: "Xử lý IPN thành công!", data: "" });
  } catch (error) {
    await session.abortTransaction();
    console.error(
      `Lỗi trong handlePaymentIPN cho đơn hàng ${req.query.vnp_TxnRef}: ${error.message}`
    );
    return res
      .status(200)
      .json({ status: "ERROR", message: "Lỗi không xác định!", data: "" });
  } finally {
    session.endSession();
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

    const order_id = vnp_Params.vnp_TxnRef;
    const vnp_ResponseCode = vnp_Params.vnp_ResponseCode;

    // Kiểm tra đơn hàng
    const order = await mongoose.model("OrderDetail").findById(order_id);
    if (!order) {
      return res.redirect(
        `${
          process.env.FRONTEND_URL
        }/payment-failed?message=${encodeURIComponent(
          "Không tìm thấy đơn hàng!"
        )}`
      );
    }

    // Kiểm tra chữ ký
    if (calculatedHash !== vnp_SecureHash) {
      return res.redirect(
        `${
          process.env.FRONTEND_URL
        }/payment-failed?message=${encodeURIComponent("Sai chữ ký!")}`
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
      `Lỗi trong handlePaymentReturn cho đơn hàng ${req.query.vnp_TxnRef}: ${error.message}`
    );
    return res.redirect(
      `${process.env.FRONTEND_URL}/payment-failed?message=${encodeURIComponent(
        "Lỗi xử lý thanh toán!"
      )}`
    );
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

    setImmediate(async () => {
      const newSession = await mongoose.startSession();
      newSession.startTransaction();
      try {
        await orderService.updateOrderAmounts(order._id, newSession);
        await newSession.commitTransaction();
      } catch (error) {
        await newSession.abortTransaction();
        console.error("Error updating order amounts:", error.message);
      } finally {
        newSession.endSession();
      }
    });

    // Gửi thông báo Socket.IO
    const io = socket.getIO();
    // Lấy thông tin bàn từ ReservedTable và TableInfo (không dùng session vì giao dịch đã commit)
    let tableInfo = "N/A";
    try {
      const reservedTables = await ReservedTable.find({
        reservation_id: order._id,
      })
        .populate("table_id", "table_number area")
        .lean();
      tableInfo =
        reservedTables.length > 0
          ? reservedTables
              .map(
                (table) =>
                  `${table.table_id.table_number} (${table.table_id.area})`
              )
              .join(", ")
          : "N/A";
    } catch (socketError) {
      console.error(
        "[Socket.IO] Lỗi khi lấy thông tin bàn:",
        socketError.message
      );
    }

    // Tạo danh sách món được thêm từ req.body.items
    const addedItems = items.map((item) => {
      const itemDetails = itemMap.get(item.id);
      const sizeInfo =
        item.size && itemDetails?.sizes
          ? itemDetails.sizes.find((s) => s.name === item.size)
          : null;
      return {
        item_id: item.id,
        quantity: item.quantity,
        size: item.size || null,
        note: item.note || "",
        itemName: itemDetails?.name || "Unknown",
        itemImage: itemDetails?.image || null,
        itemPrice: sizeInfo ? sizeInfo.price : itemDetails?.price || 0,
      };
    });

    const notification = {
      id: `notif_${Date.now()}`,
      type: "ORDER_ITEMS_UPDATE",
      title: "Món ăn được thêm vào đơn hàng",
      message: `Đã thêm món vào đơn hàng cho bàn ${tableInfo}`,
      data: {
        orderId: order._id.toString(),
        type: order.type,
        status: order.status,
        table: tableInfo,
        time: order.time
          .toLocaleString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })
          .replace(",", ""),
        addedItems, // Chỉ gửi các món được thêm từ req.body.items
      },
      timestamp: new Date().toISOString(),
      action: {
        label: "Xem chi tiết",
        type: "VIEW_DETAILS",
        payload: { orderId: order._id.toString() },
      },
    };
    io.to("adminRoom").emit("orderUpdate", notification);
    console.log(
      `[Socket.IO] Emitted ORDER_ITEMS_UPDATE orderUpdate: ${JSON.stringify(
        notification,
        null,
        2
      )}`
    );

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
    const io = socket.getIO();
    // Lấy thông tin bàn từ ReservedTable và TableInfo (không dùng session vì giao dịch đã commit)
    let tableInfo = "N/A";
    try {
      const reservedTables = await ReservedTable.find({
        reservation_id: order._id,
      })
        .populate("table_id", "table_number area")
        .lean();
      tableInfo =
        reservedTables.length > 0
          ? reservedTables
              .map(
                (table) =>
                  `${table.table_id.table_number} (${table.table_id.area})`
              )
              .join(", ")
          : "N/A";
    } catch (socketError) {
      console.error(
        "[Socket.IO] Lỗi khi lấy thông tin bàn:",
        socketError.message
      );
    }

    const notification = {
      id: `notif_${Date.now()}`,
      type: "ORDER_ITEMS_UPDATE",
      title: "Món ăn bị hủy khỏi đơn hàng",
      message: `Đã hủy món khỏi đơn hàng cho bàn ${tableInfo}`,
      data: {
        orderId: order._id.toString(),
        type: order.type,
        status: order.status,
        table: tableInfo,
        time: order.time
          .toLocaleString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })
          .replace(",", ""),
        canceledItems: enrichedCanceledItems, // Danh sách món bị hủy từ req.body.items
      },
      timestamp: new Date().toISOString(),
      action: {
        label: "Xem chi tiết",
        type: "VIEW_DETAILS",
        payload: { orderId: order._id.toString() },
      },
    };
    io.to("adminRoom").emit("orderUpdate", notification);
    console.log(
      `[Socket.IO] Emitted ORDER_ITEMS_UPDATE orderUpdate: ${JSON.stringify(
        notification,
        null,
        2
      )}`
    );

    setImmediate(async () => {
      const newSession = await mongoose.startSession();
      newSession.startTransaction();
      try {
        await orderService.updateOrderAmounts(order._id, newSession);
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

const payOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { order_id, payment_method } = req.body;

    // Kiểm tra đầu vào
    if (!order_id || !mongoose.Types.ObjectId.isValid(order_id)) {
      return res.status(400).json({
        status: "ERROR",
        message: "Yêu cầu phải có order_id hợp lệ!",
        data: "",
      });
    }
    if (
      !payment_method ||
      !["cash", "bank_transfer"].includes(payment_method)
    ) {
      return res.status(400).json({
        status: "ERROR",
        message: "Phương thức thanh toán phải là 'cash' hoặc 'bank_transfer'!",
        data: "",
      });
    }

    // Kiểm tra đơn hàng
    const order = await OrderDetail.findById(order_id).session(session);
    if (!order) {
      return res.status(404).json({
        status: "ERROR",
        message: "Không tìm thấy đơn hàng!",
        data: "",
      });
    }
    if (order.status !== "confirmed") {
      return res.status(400).json({
        status: "ERROR",
        message: "Chỉ các đơn hàng đã xác nhận mới có thể thanh toán!",
        data: "",
      });
    }
    if (order.payment_status === "success") {
      return res.status(400).json({
        status: "ERROR",
        message: "Đơn hàng đã được thanh toán!",
        data: "",
      });
    }

    // Cập nhật số tiền đơn hàng bằng hàm updateOrderAmounts
    await orderService.updateOrderAmounts(order_id, session);

    // Cập nhật thông tin đơn hàng
    await OrderDetail.findByIdAndUpdate(
      order_id,
      {
        cashier_id: req.user._id,
        payment_method,
        status: "completed",
        payment_status: "success",
        payment_initiated_at: new Date(),
        transaction_id: `TX-${order_id}-${Date.now()}`,
      },
      { session }
    );

    // Cập nhật end_time trong ReservationTable
    const reservation = await ReservedTable.findOne({
      reservation_id: order_id,
    }).session(session);
    if (reservation) {
      const currentTime = new Date();
      const endTime = new Date(currentTime.getTime() - 60 * 1000);
      await ReservedTable.findOneAndUpdate(
        { reservation_id: order_id },
        { end_time: endTime },
        { session }
      );
    }

    // Hoàn tất giao dịch
    await session.commitTransaction();

    // Gửi thông báo Socket.IO
    const io = socket.getIO();
    io.to("adminRoom").emit("orderPaid", {
      orderId: order_id,
      payment_method,
      status: "completed",
      message: `Đơn hàng ${order_id} đã được thanh toán bằng ${payment_method}`,
    });

    return res.status(200).json({
      status: "SUCCESS",
      message: "Thanh toán đơn hàng và cập nhật trạng thái bàn thành công!",
      data: "",
    });
  } catch (error) {
    await session.abortTransaction();
    return res.status(500).json({
      status: "ERROR",
      message: error.message || "Đã xảy ra lỗi khi xử lý thanh toán!",
      data: "",
    });
  } finally {
    session.endSession();
  }
};

const testNewOrder1 = async (req, res) => {
  try {
    const io = socket.getIO(); // Lấy instance io

    // Dữ liệu giả lập thông báo đơn hàng mới
    const notification = {
      id: `notif_${Date.now()}`, // ID duy nhất cho thông báo
      type: "UPDATE_ORDER",
      title: "Món ăn cho mèo",
      message: `Món Bia heineken (x1) đã được thêm vào đơn hàng #test123`,
      data: {
        orderId: "test123",
        table: {
          tableNumber: 101,
          area: "Tầng 1",
        },
        item: {
          itemId: "68138d0e7ffb41397fb436de",
          itemName: "Bia heineken",
          quantity: 1,
          size: null,
          note: "",
          itemPrice: 35000,
        },
        customerId: req.user?._id || "testUser123",
        username: req.user?.username || "testUser",
      },
      timestamp: new Date().toISOString(),
      action: {
        label: "Xem chi tiết",
        type: "VIEW_DETAILS",
        payload: { orderId: "test123" },
      },
    };

    // Log dữ liệu gửi đi
    console.log(
      "[testNewOrder2] Dữ liệu thông báo gửi đi:",
      JSON.stringify(notification, null, 2)
    );

    // Gửi sự kiện notification đến adminRoom
    io.to("adminRoom").emit("notification", notification);
    console.log(
      `[Socket.IO] Emitted notification to adminRoom for order ${notification.data.orderId}`
    );

    // Trả về response
    res.json({
      status: "SUCCESS",
      message: "Thông báo test đơn hàng gửi thành công",
      data: notification,
    });
  } catch (error) {
    console.error("[testNewOrder2] Error:", error.message);
    res.status(500).json({
      status: "ERROR",
      message: error.message || "Lỗi khi gửi thông báo test đơn hàng!",
    });
  }
};

// const testNewOrder2 = async (req, res) => {
//   try {
//     const io = socket.getIO(); // Lấy instance io
//     const { type = "ADD_ITEM" } = req.body; // Lấy type từ body JSON

//     // Dữ liệu giả lập thông báo
//     let notification;
//     const orderId = "test123";
//     const customerId = req.user?._id || "6811ff6de5541de1a1e96b1d";
//     const username = req.user?.username || "testUser";
//     const table = {
//       tableNumber: 101,
//       area: "Tầng 2",
//     };
//     const timestamp = new Date().toISOString();
//     const id = `notif_${Date.now()}`;

//     switch (type) {
//       case "CREATE_ORDER":
//         notification = {
//           id,
//           type: "CREATE_ORDER",
//           title: "Khách hàng yêu cầu thanh toán",
//           message: `Khách hàng đang yêu cầu thanh toán cho bàn: ${table.tableNumber} (${table.area})`,
//           data: {
//             orderId,
//             table,
//             order: {
//               type: "reservation",
//               status: "pending", // Thay confirmed thành pending để đúng ngữ cảnh
//             },
//             item: {
//               itemName: "Bia heineken",
//               quantity: 1,
//               note: "Không đá",
//             },
//             customerId,
//             username,
//           },
//           timestamp,
//           action: {
//             label: "Xem chi tiết",
//             type: "VIEW_DETAILS",
//             payload: { orderId },
//           },
//         };
//         break;

//       case "ADD_ITEM":
//         notification = {
//           id,
//           type: "ADD_ITEM",
//           title: "Món mới được thêm",
//           message: `Món Bia heineken (x1) đã được thêm vào đơn hàng #${orderId}`,
//           data: {
//             orderId,
//             table,
//             item: {
//               itemName: "Bia heineken",
//               quantity: 1,
//               note: "Không đá",
//             },
//             customerId,
//             username,
//           },
//           timestamp,
//           action: {
//             label: "Xem chi tiết",
//             type: "VIEW_DETAILS",
//             payload: { orderId },
//           },
//         };
//         break;

//       case "DELETE_ITEM":
//         notification = {
//           id,
//           type: "DELETE_ITEM",
//           title: "Món đã bị hủy",
//           message: `Món Đậu luộc (x1) đã bị hủy khỏi đơn hàng #${orderId}`,
//           data: {
//             orderId,
//             table,
//             item: {
//               itemName: "Đậu luộc",
//               quantity: 1,
//               note: "",
//             },
//             customerId,
//             username,
//           },
//           timestamp,
//           action: {
//             label: "Xem chi tiết",
//             type: "VIEW_DETAILS",
//             payload: { orderId },
//           },
//         };
//         break;

//       case "CANCEL_ORDER":
//         notification = {
//           id,
//           type: "CANCEL_ORDER",
//           title: "Đơn hàng bị hủy",
//           message: `Đơn hàng #${orderId} đã bị hủy`,
//           data: {
//             orderId,
//             table,
//             order: {
//               type: "reservation",
//               status: "cancelled",
//             },
//             customerId,
//             username,
//           },
//           timestamp,
//           action: {
//             label: "Xem chi tiết",
//             type: "VIEW_DETAILS",
//             payload: { orderId },
//           },
//         };
//         break;

//       case "CONFIRM_ORDER":
//         notification = {
//           id,
//           type: "CONFIRM_ORDER",
//           title: "Đơn hàng được xác nhận",
//           message: `Đơn hàng #${orderId} đã được xác nhận`,
//           data: {
//             orderId,
//             table,
//             order: {
//               type: "reservation",
//               status: "confirmed",
//             },
//             customerId,
//             username,
//           },
//           timestamp,
//           action: {
//             label: "Xem chi tiết",
//             type: "VIEW_DETAILS",
//             payload: { orderId },
//           },
//         };
//         break;

//       case "PAYMENT_SUCCESS":
//         notification = {
//           id,
//           type: "PAYMENT_SUCCESS",
//           title: "Thanh toán thành công",
//           message: `Đơn hàng #${orderId} đã được thanh toán với số tiền 170,000 VND`,
//           data: {
//             orderId,
//             table,
//             payment: {
//               accountName: "Nguyen Van A",
//               amount: 170000,
//               transactionTime: timestamp,
//             },
//             customerId,
//             username,
//           },
//           timestamp,
//           action: {
//             label: "Xem chi tiết",
//             type: "VIEW_DETAILS",
//             payload: { orderId },
//           },
//         };
//         break;

//       default:
//         throw new Error("Loại thông báo không hợp lệ!");
//     }

//     // Log dữ liệu gửi đi
//     console.log(
//       "[testNewOrder2] Dữ liệu thông báo gửi đi:",
//       JSON.stringify(notification, null, 2)
//     );

//     // Gửi sự kiện notification đến adminRoom
//     io.to("adminRoom").emit("notification", notification);
//     console.log(
//       `[Socket.IO] Emitted notification to adminRoom for order ${notification.data.orderId}`
//     );

//     // Kiểm tra số client trong adminRoom
//     io.in("adminRoom")
//       .allSockets()
//       .then((sockets) => {
//         console.log(`[Socket.IO] Clients in adminRoom: ${sockets.size}`);
//       });

//     // Trả về response
//     res.json({
//       status: "SUCCESS",
//       message: "Thông báo test đơn hàng gửi thành công",
//       data: notification,
//     });
//   } catch (error) {
//     console.error("[testNewOrder2] Error:", error.message);
//     res.status(500).json({
//       status: "ERROR",
//       message: error.message || "Lỗi khi gửi thông báo test đơn hàng!",
//     });
//   }
// };

const testNewOrder2 = async (req, res) => {
  try {
    const { tableId } = req.params; // Lấy tableId từ params

    // Kiểm tra tính hợp lệ của tableId
    if (!mongoose.Types.ObjectId.isValid(tableId)) {
      return res.status(400).json({
        status: "ERROR",
        message: "tableId không hợp lệ!",
        data: null,
      });
    }

    // Lấy thông tin bàn từ TableInfo
    const tableInfo = await TableInfo.findById(tableId).lean();
    if (!tableInfo) {
      return res.status(404).json({
        status: "ERROR",
        message: "Bàn không tồn tại!",
        data: null,
      });
    }

    // Gửi thông báo Socket.IO
    const io = socket.getIO();
    const notification = {
      id: `notif_${Date.now()}`,
      type: "CALL_STAFF",
      title: "Yêu cầu nhân viên thanh toán",
      message: `Bàn ${tableInfo.table_number || "N/A"} (${
        tableInfo.area || "N/A"
      }) yêu cầu nhân viên thanh toán`,
      data: {
        orderId: "",
      },
      timestamp: new Date().toISOString(),
      action: {
        label: "Xem chi tiết",
        type: "VIEW_DETAILS",
        payload: { tableId: tableId },
      },
    };
    io.to("adminRoom").emit("notification", notification);
    console.log(
      `[Socket.IO] Emitted CREATE_ORDER notification: ${JSON.stringify(
        notification,
        null,
        2
      )}`
    );

    // Trả về response
    res.json({
      status: "SUCCESS",
      message: "Thông báo yêu cầu nhân viên gửi thành công",
      data: notification,
    });
  } catch (error) {
    console.error("[testNewOrder3] Error:", error.message);
    res.status(500).json({
      status: "ERROR",
      message: error.message || "Lỗi khi gửi thông báo yêu cầu nhân viên!",
      data: null,
    });
  }
};

const testNewOrder3 = async (req, res) => {
  try {
    const { tableId } = req.params; // Lấy tableId từ params

    // Kiểm tra tính hợp lệ của tableId
    if (!mongoose.Types.ObjectId.isValid(tableId)) {
      return res.status(400).json({
        status: "ERROR",
        message: "tableId không hợp lệ!",
        data: null,
      });
    }

    // Lấy thông tin bàn từ TableInfo
    const tableInfo = await TableInfo.findById(tableId).lean();
    if (!tableInfo) {
      return res.status(404).json({
        status: "ERROR",
        message: "Bàn không tồn tại!",
        data: null,
      });
    }

    // Gửi thông báo Socket.IO
    const io = socket.getIO();
    const notification = {
      id: `notif_${Date.now()}`,
      type: "CALL_STAFF",
      title: "Yêu cầu nhân viên",
      message: `Bàn ${tableInfo.table_number || "N/A"} (${
        tableInfo.area || "N/A"
      }) yêu cầu nhân viên`,
      data: {
        orderId: "",
      },
      timestamp: new Date().toISOString(),
      action: {
        label: "Xem chi tiết",
        type: "VIEW_DETAILS",
        payload: { tableId: tableId },
      },
    };
    io.to("adminRoom").emit("notification", notification);
    console.log(
      `[Socket.IO] Emitted CREATE_ORDER notification: ${JSON.stringify(
        notification,
        null,
        2
      )}`
    );

    // Trả về response
    res.json({
      status: "SUCCESS",
      message: "Thông báo yêu cầu nhân viên gửi thành công",
      data: notification,
    });
  } catch (error) {
    console.error("[testNewOrder3] Error:", error.message);
    res.status(500).json({
      status: "ERROR",
      message: error.message || "Lỗi khi gửi thông báo yêu cầu nhân viên!",
      data: null,
    });
  }
};

module.exports = {
  getAllOrders,
  getAllOrdersInfo,
  getOrderInfo,
  createOrder,
  createTableOrder,
  rateOrder,
  reserveTable,
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
  payOrder,
  testNewOrder1,
  testNewOrder2,
  testNewOrder3,
};

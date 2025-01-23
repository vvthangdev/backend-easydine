const OrderDetail = require("../models/order_detail.model");
const orderService = require("../services/order.service");
const ReservedTable = require("../models/reservation_table.model");
const sequelize = require("../config/db.config"); // Đảm bảo import sequelize để sử dụng transaction
const ItemOrder = require("../models/item_order.model");
const Item = require("../models/item.model");
const emailService = require("../services/send-email.service");
const { getUserByUserId } = require("../services/user.service");

const getAllOrders = async (req, res) => {
  try {
    const orderDetail = await OrderDetail.findAll();
    res.json(orderDetail);
  } catch (error) {
    res.status(500).json({ error: "Error fetching orders" });
  }
};

const getAllOrdersInfo = async (req, res) => {
  try {
    // Lấy tất cả các đơn hàng
    const orders = await OrderDetail.findAll();

    // Tính tổng tiền (`totalAmount`) cho mỗi đơn hàng
    const enrichedOrders = await Promise.all(
      orders.map(async (order) => {
        // Lấy tất cả các mục hàng liên quan đến đơn hàng
        const itemOrders = await ItemOrder.findAll({
          where: { order_id: order.id },
        });

        // Tính tổng tiền từ các mục hàng
        let totalAmount = 0;
        for (const itemOrder of itemOrders) {
          const item = await Item.findOne({ where: { id: itemOrder.item_id } });
          if (item) {
            totalAmount += item.price * itemOrder.quantity;
          }
        }

        // Trả về đơn hàng với các thông tin bổ sung
        return {
          id: order.id,
          time: order.time,
          num_people: order.num_people || 0, // Nếu không có, trả về 0
          totalAmount,
          type: order.type,
        };
      })
    );

    // Trả về kết quả JSON
    res.json(enrichedOrders);
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ error: "Error fetching orders" });
  }
};

const getOrderInfo = async (req, res) => {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ error: "Order ID is required" });
    }

    // Lấy thông tin các bàn đã đặt
    const reservedTables = await ReservedTable.findAll({
      where: { reservation_id: id },
    });

    // Lấy thông tin các món hàng trong đơn hàng
    const itemOrders = await ItemOrder.findAll({
      where: { order_id: id },
    });

    // Duyệt qua từng itemOrder để truy vấn thêm tên món ăn từ bảng Item
    const enrichedItemOrders = await Promise.all(
      itemOrders.map(async (itemOrder) => {
        const item = await Item.findOne({ where: { id: itemOrder.item_id } });
        return {
          ...itemOrder.dataValues, // Copy dữ liệu từ itemOrder
          itemName: item ? item.name : null, // Thêm tên món ăn
          itemImage: item ? item.image : null, // Thêm hình ảnh món ăn (nếu cần)
          itemPrice: item ? item.price : null, // Thêm giá món ăn (nếu cần)
        };
      })
    );

    // Trả về dữ liệu JSON
    res.json({
      status: "SUCCESS",
      message: "Order details fetched successfully",
      reservedTables,
      itemOrders: enrichedItemOrders,
    });
  } catch (error) {
    console.error("Error fetching order info:", error);
    res.status(500).json({ error: "Error fetching order info" });
  }
};

const getAllOrdersOfCustomer = async (req, res) => {
  try {
    const customer_id = req.user.id;
    const orders = await OrderDetail.findAll({
      where: { customer_id: customer_id },
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: "Error fetching orders" });
  }
};

const createOrder = async (req, res) => {
  const transaction = await sequelize.transaction(); // Khởi tạo transaction
  try {
    let { start_time, num_people, items, ...orderData } = req.body; // Số lượng khách và danh sách các món hàng
    const user = await getUserByUserId(req.user.id);
    // Tạo order mới trong transaction
    const newOrder = await orderService.createOrder(
      {
        customer_id: req.user.id,
        time: start_time,
        num_people, // Lưu số lượng khách vào order
        ...orderData,
      },
      { transaction } // Pass transaction vào trong service
    );

    // Lấy thời gian bắt đầu từ orderData
    const startTime = newOrder.time; // Giả sử thời gian bắt đầu là time trong orderData

    // Cộng thêm thời gian từ biến môi trường (mặc định là 120 phút nếu không có giá trị trong ENV)
    const offsetMinutes = parseInt(process.env.END_TIME_OFFSET_MINUTES) || 120;
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + offsetMinutes);

    // Chuyển startTime và endTime thành dạng chuỗi ISO chuẩn
    const startTimeFormatted = startTime.toISOString();
    const endTimeFormatted = endTime.toISOString();

    // Kiểm tra bàn trống trong khoảng thời gian người dùng chọn và sử dụng lock
    const availableTables = await orderService.checkAvailableTables(
      startTimeFormatted,
      endTimeFormatted,
      { transaction }
    );

    if (availableTables && availableTables.length > 0) {
      // Tính toán số bàn cần thiết để phục vụ tất cả khách
      let remainingPeople = num_people;
      let reservedTables = [];
      let totalCapacity = 0;

      // Duyệt qua các bàn có sẵn và tính tổng sức chứa
      for (let table of availableTables) {
        totalCapacity += table.capacity;

        if (remainingPeople > 0) {
          const peopleAssignedToTable = Math.min(
            remainingPeople,
            table.capacity
          );
          remainingPeople -= peopleAssignedToTable;
          reservedTables.push({
            reservation_id: newOrder.id,
            table_id: table.table_number,
            people_assigned: peopleAssignedToTable,
            start_time: startTime,
            end_time: endTime,
          });
        }

        if (remainingPeople <= 0) {
          break;
        }
      }

      // Kiểm tra nếu tổng sức chứa không đủ cho tất cả khách
      if (remainingPeople > 0) {
        // Không đủ bàn
        await transaction.rollback(); // Rollback transaction nếu không đủ bàn
        res
          .status(400)
          .json({ error: "Not enough available tables to seat all guests." });
        return; // Không lưu vào DB
      }

      // Nếu đủ bàn, lưu thông tin reservation vào DB
      await orderService.createReservations(reservedTables, { transaction });

      // Nếu có món hàng, tạo item orders (mối quan hệ giữa món hàng và đơn hàng)
      if (items && items.length > 0) {
        let itemOrders = items.map((item) => ({
          item_id: item.id,
          quantity: item.quantity,
          order_id: newOrder.id,
        }));

        // Lưu thông tin vào bảng item_order
        await orderService.createItemOrders(itemOrders, { transaction });
      }

      // Commit transaction khi tất cả các thao tác thành công
      await transaction.commit();

      await emailService.sendOrderConfirmationEmail(
        user.email,
        user.name,
        newOrder
      );

      // Trả về kết quả order đã tạo
      res.status(201).json(newOrder);
    } else {
      // Nếu không có bàn trống
      await transaction.rollback(); // Rollback transaction nếu không có bàn trống
      res
        .status(400)
        .json({ error: "No available tables for the selected time" });
    }
  } catch (error) {
    // Xử lý lỗi và rollback transaction
    console.error("Error creating order:", error);
    await transaction.rollback(); // Rollback transaction nếu có lỗi
    res.status(500).json({ error: "Error creating order" });
  }
};

const updateOrder = async (req, res) => {
  try {
    const { id, ...otherFields } = req.body; // Adjust as needed to accept relevant fields
    const { status } = req.body;
    if (!id) {
      return res.status(400).send("Order number required.");
    }
    if (!otherFields || (Object.keys(otherFields).length === 0 && !status)) {
      return res.status(400).send("No fields to update.");
    }
    // Update the user information in the database
    const updatedOrder = await orderService.updateOrder(id, {
      ...otherFields, // Spread other fields if there are additional updates
    });

    if (!updatedOrder) {
      return res.status(404).send("Order not found!");
    }
    res.json({
      status: "SUCCESS",
      message: "Order updated successfully!",
      Order: updatedOrder,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error updating order" });
  }
};

const deleteOrder = async (req, res) => {
  const { id } = req.params; // Lấy id của đơn hàng từ params
  console.log(req.params);

  try {
    // Tìm đơn hàng theo id
    const order = await OrderDetail.findOne({ where: { id } });

    // Kiểm tra xem đơn hàng có tồn tại không
    if (!order) {
      return res.status(404).json({ error: "Order not found!" });
    }

    // Xóa đơn hàng
    await order.destroy();

    // Trả về phản hồi thành công
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
  // updateOrderStatus,
  getAllOrdersOfCustomer,
  deleteOrder,
};

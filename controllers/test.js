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
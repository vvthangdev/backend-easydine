const cron = require("node-cron");
const ReservationTable = require("../models/reservation_table.model");
const OrderDetail = require("../models/order_detail.model");
const mongoose = require("mongoose");

async function cancelExpiredOnlineReservations() {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const BUFFER_TIME = (parseInt(process.env.BUFFER_TIME) || 15) * 60 * 1000;
    const currentTime = new Date();

    const expiredReservations = await ReservationTable.find({
      start_time: { $lt: new Date(currentTime.getTime() - BUFFER_TIME) },
    })
      .select("reservation_id start_time")
      .session(session)
      .lean();

    if (expiredReservations.length === 0) {
      console.log(
        `[${new Date().toISOString()}] Không có đặt chỗ online nào quá hạn.`
      );
      await session.commitTransaction();
      return;
    }

    const cancelPromises = expiredReservations.map(async (reservation) => {
      const order = await OrderDetail.findById(reservation.reservation_id)
        .select("status type")
        .session(session)
        .lean();
      if (order && order.type === "reservation" && order.status === "pending") {
        await OrderDetail.updateOne(
          { _id: reservation.reservation_id },
          { status: "canceled" },
          { session }
        );
        console.log(
          `[${new Date().toISOString()}] Hủy đặt chỗ online: reservation_id=${
            reservation.reservation_id
          }`
        );
      }
    });

    await Promise.all(cancelPromises);
    await session.commitTransaction();
    console.log(
      `[${new Date().toISOString()}] Hoàn tất kiểm tra đặt chỗ online quá hạn.`
    );
  } catch (error) {
    await session.abortTransaction();
    console.error(
      `[${new Date().toISOString()}] Lỗi khi hủy đặt chỗ online quá hạn:`,
      error
    );
  } finally {
    session.endSession();
  }
}

// Chạy mỗi 5 phút
cron.schedule("*/5 * * * *", async () => {
  console.log(
    `[${new Date().toISOString()}] Bắt đầu kiểm tra đặt chỗ online quá hạn...`
  );
  await cancelExpiredOnlineReservations();
});

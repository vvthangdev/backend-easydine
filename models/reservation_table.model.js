const { DataTypes } = require("sequelize");
const sequelize = require("../config/db.config"); // Đảm bảo bạn thay đổi đường dẫn cho phù hợp
require("dotenv").config(); // Đảm bảo bạn sử dụng dotenv để tải các biến môi trường

const OrderDetail = require("./order_detail.model"); // Đảm bảo đã import mô hình OrderDetail
const TableInfo = require("./table_info.model"); // Đảm bảo đã import mô hình TableInfo

const ReservationTable = sequelize.define(
  "ReservationTable",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    reservation_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: OrderDetail,
        key: "id",
      },
      onDelete: "CASCADE",
    },
    table_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: TableInfo,
        key: "table_number",
      },
      onDelete: "CASCADE",
    },
    start_time: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    end_time: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    tableName: "reservation_table",
    timestamps: false,
    hooks: {
      beforeCreate: (reservation) => {
        const durationHours =
          parseInt(process.env.RESERVATION_DURATION_HOURS, 10) || 2; // Giá trị mặc định là 2 giờ
        reservation.end_time = new Date(reservation.start_time);
        reservation.end_time.setHours(
          reservation.end_time.getHours() + durationHours
        );
      },
      beforeUpdate: (reservation) => {
        const durationHours =
          parseInt(process.env.RESERVATION_DURATION_HOURS, 10) || 2; // Giá trị mặc định là 2 giờ
        reservation.end_time = new Date(reservation.start_time);
        reservation.end_time.setHours(
          reservation.end_time.getHours() + durationHours
        );
      },
    },
  }
);

module.exports = ReservationTable;

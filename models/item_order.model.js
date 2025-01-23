const { DataTypes } = require("sequelize");
const sequelize = require("../config/db.config"); // Đảm bảo bạn thay đổi đường dẫn cho phù hợp
const OrderDetail = require("./order_detail.model");

const ItemOrder = sequelize.define(
  "ItemOrder",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    item_id: {
      type: DataTypes.INTEGER,
      allowNull: false, // Cột này không thể null
      references: {
        model: "item", // Tên bảng tham chiếu
        key: "id", // Tên cột tham chiếu trong bảng `item`
      },
      onDelete: "CASCADE", // Xóa dữ liệu liên quan khi xóa item
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: true, // Cột này có thể null nếu không có giá trị
    },
    order_id: {
      type: DataTypes.INTEGER,
      allowNull: false, // Cột này không thể null
      references: {
        model: OrderDetail, // Tên bảng tham chiếu
        key: "id", // Tên cột tham chiếu trong bảng `order_detail`
      },
      onDelete: "CASCADE", // Xóa dữ liệu liên quan khi xóa order
    },
  },
  {
    tableName: "item_order", // Tên bảng trong cơ sở dữ liệu
    timestamps: false, // Nếu không muốn sử dụng `createdAt` và `updatedAt`
  }
);

module.exports = ItemOrder;

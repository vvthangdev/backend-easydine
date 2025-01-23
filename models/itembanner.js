const { DataTypes } = require("sequelize");
const sequelize = require("../config/db.config"); // Đảm bảo bạn thay đổi đường dẫn cho phù hợp

const ItemBanner = sequelize.define(
  "ItemBanner",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    image: {
      type: DataTypes.STRING(255),
      allowNull: false, // Cột này không thể null
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false, // Cột này không thể null
    },
  },
  {
    tableName: "item_banner", // Tên bảng trong cơ sở dữ liệu
    timestamps: false, // Nếu không muốn sử dụng `createdAt` và `updatedAt`
  }
);

module.exports = ItemBanner;
const { DataTypes } = require("sequelize");
const sequelize = require("../config/db.config"); // Đảm bảo bạn thay đổi đường dẫn cho phù hợp

const Item = sequelize.define(
  "Item",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(255),

      allowNull: false, // Cột này không thể null
    },
    image: {
      type: DataTypes.STRING(255),
      allowNull: false, // Cột này không thể null
    },
    price: {
      type: DataTypes.INTEGER,
      allowNull: true, // Cột này có thể null nếu không có giá trị
    },
  },
  {
    tableName: "item", // Tên bảng trong cơ sở dữ liệu
    timestamps: false, // Nếu không muốn sử dụng `createdAt` và `updatedAt`
  }
);

module.exports = Item;

const { DataTypes } = require("sequelize");
const sequelize = require("../config/db.config"); // Đảm bảo bạn thay đổi đường dẫn cho phù
const Item = require("../models/item.model");

const ItemCategory = sequelize.define(
  "ItemCategory",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    itemId: {
      type: DataTypes.INTEGER,
      references: {
        model: "Item", // Tên bảng tham chiếu (Item)
        key: "id", // Khóa ngoại tham chiếu đến cột `id` của bảng `Item`
      },
      allowNull: false, // Mỗi loại món ăn phải thuộc về một món ăn
      onDelete: "CASCADE",  // Khi xóa item, các itemCategory có liên quan sẽ bị xóa theo
      onUpdate: "CASCADE",  // Khi cập nhật item, các itemCategory có liên quan sẽ tự động cập nhật itemId
    },
    category: {
      type: DataTypes.ENUM,
      values: ["Món chính", "Phổ biến", "Cơm", "Bún_Phở", "Đồ uống", "Đồ chay"],
      allowNull: false, // Cột này không thể null
    },
  },
  {
    tableName: "item_category", // Tên bảng trong cơ sở dữ liệu
    timestamps: false, // Nếu không muốn sử dụng `createdAt` và `updatedAt`
  }
);

module.exports = ItemCategory;

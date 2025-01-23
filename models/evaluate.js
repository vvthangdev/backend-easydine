const { DataTypes } = require("sequelize");
const sequelize = require("../config/db.config"); 
const Item = require("./item.model");
const OrderDetail = require("./order_detail.model");

const Evaluate = sequelize.define('Evaluate', {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,  
    },
    item_id: { 
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { 
        model: Item,
        key: "id"
      }
    },
    order_id: { 
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: OrderDetail,
        id: "id"
      }
    },
    star: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    comment: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'evaluate',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "order_id" },
        ]
      },
    ]
  });
module.exports = Evaluate;
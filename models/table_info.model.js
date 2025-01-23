const { DataTypes } = require("sequelize");
const sequelize = require("../config/db.config"); // Adjust the path to your database config

const TableInfo = sequelize.define('TableInfo', {
  table_number: {
    type: DataTypes.INTEGER,
    primaryKey: true,
  },
  capacity: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
}, {
  tableName: 'table_info',
  timestamps: false,
});

module.exports = TableInfo;


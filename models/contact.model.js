const { DataTypes } = require("sequelize");
const sequelize = require("../config/db.config"); 

const Contact = sequelize.define('Contact', {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,  
      autoIncrement: true
    },
    name: { 
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    email: { 
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING(15),
      allowNull: false
    },
    message: {
        type: DataTypes.TEXT,
        allowNull: false
    }
  }, {
    sequelize,
    tableName: 'contact',
    timestamps: false,
  });
module.exports = Contact;
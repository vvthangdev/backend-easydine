const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('conversation', {
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    user1: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'user',
        key: 'id'
      }
    },
    user2: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'user',
        key: 'id'
      }
    },
    last_message: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
    }
    // last_message_id: {
    //   type: DataTypes.INTEGER,
    //   allowNull: false
    // }
  }, 
  {
    sequelize,
    tableName: 'conversation',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "id" },
        ]
      },
      {
        name: "user1",
        using: "BTREE",
        fields: [
          { name: "user1" },
        ]
      },
      {
        name: "user2",
        using: "BTREE",
        fields: [
          { name: "user2" },
        ]
      },
    ]
  });
};

const User = require("../models/user.model.js");
require("dotenv").config();
const userService = require("../services/user.service");

const adminDeleteUser = async (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(401).send("Username required!");
    }

    const user = await userService.getUserByUserName(username);
    if (!user) {
      return res.status(404).send("User not found!");
    }

    await userService.deleteUser(username);

    res.json({
      status: "SUCCESS",
      message: "User deleted successfully!",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).send("An error occurred while deleting the user!");
  }
};

const adminUpdateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { ...userInfo } = req.body;

    const user = await userService.getUserByUserId(id);
    if (!user) {
      return res.status(404).send("User not found!");
    }

    const updatedUser = await userService.updateUser(user.username, {
      ...userInfo,
    });

    if (!updatedUser) {
      return res.status(404).send("User not found!");
    }

    res.json({
      status: "SUCCESS",
      message: "User updated successfully!",
      user: updatedUser,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).send("An error occurred while updating the user!");
  }
};

const adminGetUserInfo = async (req, res) => {
  try {
    const customerId = req.query.id;

    const customer = await userService.getUserByUserId(customerId);
    if (!customer) {
      return res
        .status(404)
        .json({ error: "Không tìm thấy thông tin khách hàng" });
    }

    res.status(200).json(customer);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Không thể lấy thông tin khách hàng" });
  }
};

module.exports = {
  adminDeleteUser,
  adminUpdateUser,
  adminGetUserInfo,
};
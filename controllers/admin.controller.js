const User = require("../models/user.model.js");
// const bcrypt = require("bcrypt");
require("dotenv").config();
const userService = require("../services/user.service");
const authUtil = require("../utils/auth.util");
const { Auth, LoginCredentials } = require("two-step-auth");

const adminDeleteUser = async (req, res) => {
  try {
    let { username } = req.body;
    console.log(req);
    if (!username) {
      return res.status(401).send("Username required!");
    }
    // Verify the access token to ensure the user is authenticated
    const user = await userService.getUserByUserName(username);
    console.log(username);

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
    console.log(req.params);
    const { ...userInfo } = req.body;
    // console.log(userInfo);
    // const customerId = req.query.id; // Lấy customerId từ URL params
    // console.log(customerId);

    const user = await userService.getUserByUserId(id);
    console.log(user);

    const updatedUser = await userService.updateUser(user.username, {
      ...userInfo, // Spread other fields if there are additional updates
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
    const customerId = req.query.id; // Lấy customerId từ URL params
    // console.log(customerId);

    const customer = await userService.getUserByUserId(customerId);
    // console.log(customer); // Gọi DB để lấy thông tin
    if (!customer) {
      return res
        .status(404)
        .json({ error: "Không tìm thấy thông tin khách hàng" });
    }
    res.status(200).json(customer);
  } catch (error) {
    res.status(500).json({ error: "Không thể lấy thông tin khách hàng" });
  }
};

module.exports = {
  adminDeleteUser,
  adminUpdateUser,
  adminGetUserInfo,
};

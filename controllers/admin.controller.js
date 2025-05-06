const User = require("../models/user.model.js");
require("dotenv").config();
const userService = require("../services/user.service");

const adminDeleteUser = async (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({
        status: "ERROR",
        message: "Username is required!",
        data: null,
      });
    }

    const user = await userService.getUserByUserName(username);
    if (!user) {
      return res.status(404).json({
        status: "ERROR",
        message: "User not found!",
        data: null,
      });
    }

    await userService.deleteUser(username);

    return res.status(200).json({
      status: "SUCCESS",
      message: "User deleted successfully!",
      data: null,
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "An error occurred while deleting the user!",
      data: null,
    });
  }
};

const adminUpdateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { ...userInfo } = req.body;

    if (!id) {
      return res.status(400).json({
        status: "ERROR",
        message: "User ID is required!",
        data: null,
      });
    }

    const user = await userService.getUserByUserId(id);
    if (!user) {
      return res.status(404).json({
        status: "ERROR",
        message: "User not found!",
        data: null,
      });
    }

    const updatedUser = await userService.updateUser(user.username, {
      ...userInfo,
    });

    if (!updatedUser) {
      return res.status(404).json({
        status: "ERROR",
        message: "User not found!",
        data: null,
      });
    }

    return res.status(200).json({
      status: "SUCCESS",
      message: "User updated successfully!",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Error updating user:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "An error occurred while updating the user!",
      data: null,
    });
  }
};

const adminGetUserInfo = async (req, res) => {
  try {
    const customerId = req.query.id;

    if (!customerId) {
      return res.status(400).json({
        status: "ERROR",
        message: "Customer ID is required!",
        data: null,
      });
    }

    const customer = await userService.getUserByUserId(customerId);
    if (!customer) {
      return res.status(404).json({
        status: "ERROR",
        message: "Customer not found!",
        data: null,
      });
    }

    return res.status(200).json({
      status: "SUCCESS",
      message: "Customer information retrieved successfully!",
      data: customer,
    });
  } catch (error) {
    console.error("Error fetching customer info:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "An error occurred while fetching customer information!",
      data: null,
    });
  }
};

module.exports = {
  adminDeleteUser,
  adminUpdateUser,
  adminGetUserInfo,
};
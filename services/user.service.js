const bcrypt = require("bcrypt");
const User = require("../models/user.model");

async function getAllUsers(projection = {}) {
  try {
    const users = await User.find({}, projection);
    console.log("vvt check 01: users =", JSON.stringify(users, null, 2));
    console.log("vvt check 01: projection =", JSON.stringify({ refresh_token: 0, password: 0 }, null, 2));
    return users;
  } catch (error) {
    console.error("Error fetching all users:", error);
    throw new Error("Error fetching all users");
  }
}

async function getUserById(id) {
  try {
    const user = await User.findById(id);
    if (!user) throw new Error("User không tồn tại");
    return user;
  } catch (error) {
    console.error("Error fetching user by ID:", error);
    throw error;
  }
}

async function searchUsers(query) {
  try {
    if (!query || typeof query !== "string") {
      return [];
    }

    // Chuẩn hóa chuỗi tìm kiếm
    const normalizedQuery = removeVietnameseAccents(query.trim()).toLowerCase();

    // Tạo điều kiện tìm kiếm
    const conditions = {
      $or: [
        // Tìm kiếm theo tên (nameNoAccents)
        { nameNoAccents: { $regex: new RegExp(normalizedQuery, "i") } },
        // Tìm kiếm theo số điện thoại
        { phone: { $regex: new RegExp(normalizedQuery, "i") } },
        { address: { $regex: new RegExp(normalizedQuery, "i") } },
      ],
    };

    // Kiểm tra nếu query có thể là ID (MongoDB ObjectId có 24 ký tự hex)
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(query);
    if (isObjectId) {
      conditions.$or.push({ _id: query });
    }

    const users = await User.find(conditions);
    // console.log("Found users:", users); // Debug
    return users;
  } catch (error) {
    console.error("Error searching users:", error.message, error.stack);
    throw new Error(`Error searching users: ${error.message}`);
  }
}

function removeVietnameseAccents(str) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

async function isUserExists(criteria) {
  const conditions = {};
  if (criteria.email) conditions.email = criteria.email;
  if (criteria.phone) conditions.phone = criteria.phone;
  if (criteria.username) conditions.username = criteria.username;

  if (Object.keys(conditions).length === 0) return false;

  const result = await User.find(conditions);
  return result.length > 0;
}

async function createUser(userData) {
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(userData.password, saltRounds);

  const newUser = new User({
    ...userData,
    password: hashedPassword,
  });
  return await newUser.save();
}

async function getUserByUserName(username) {
  return await User.findOne({ username });
}

async function getUserByUserId(userId) {
  if (!userId || userId === "null") {
    throw new Error("Invalid user ID");
  }
  return await User.findById(userId, { refresh_token: 0, password: 0 });
}

async function getUserByEmail(email) {
  return await User.findOne({ email });
}

async function validatePassword(password, hashedPassword) {
  return await bcrypt.compare(password, hashedPassword);
}

async function updateRefreshToken(username, refreshToken) {
  try {
    const result = await User.updateOne(
      { username },
      { refresh_token: refreshToken }
    );
    return result.modifiedCount > 0;
  } catch (error) {
    console.error("Error updating refresh token: ", error);
    return false;
  }
}

const updateUser = async (username, updatedData, projection = {}) => {
  try {
    const user = await User.findOneAndUpdate(
      { username },
      { $set: updatedData },
      { new: true, projection }
    );
    if (!user) {
      throw new Error("User not found");
    }
    console.log(`vvt check: ${user} and ${projection}`)
    console.log("vvt check 01: projection =", JSON.stringify({ refresh_token: 0, password: 0 }, null, 2));
    return user;
  } catch (error) {
    console.error("Error updating user:", error);
    throw new Error("An error occurred while updating the user.");
  }
};

const deleteUser = async (username) => {
  try {
    const user = await User.findOne({ username });
    if (!user) throw new Error("User not found");

    await User.deleteOne({ username });
    console.log(`User ${username} deleted successfully!`);
  } catch (error) {
    console.log("Error deleting user: ", error);
    throw new Error("An error occurred while deleting the user.");
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  searchUsers,
  isUserExists,
  createUser,
  getUserByUserId,
  getUserByUserName,
  getUserByEmail,
  validatePassword,
  updateRefreshToken,
  updateUser,
  deleteUser,
};

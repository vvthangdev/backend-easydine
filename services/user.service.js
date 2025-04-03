const bcrypt = require("bcrypt");
const User = require("../models/user.model");

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

const updateUser = async (username, updatedData) => {
  const user = await User.findOne({ username });
  if (!user) throw new Error("User not found");

  Object.assign(user, updatedData);
  await user.save();
  return user;
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
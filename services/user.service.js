const bcrypt = require("bcrypt");
const { Op } = require("sequelize");
const User = require("../models/user.model");

async function isUserExists(criteria) {
  // Tạo mảng điều kiện `where` dựa trên các thuộc tính có trong `criteria`
  const conditions = [];

  if (criteria.email) {
    conditions.push({ email: criteria.email });
  }
  if (criteria.phone) {
    conditions.push({ phone: criteria.phone });
  }
  if (criteria.username) {
    conditions.push({ username: criteria.username });
  }

  // Nếu không có điều kiện nào được cung cấp, trả về `false` ngay lập tức
  if (conditions.length === 0) {
    return false;
  }

  // Thực hiện truy vấn với điều kiện `Op.or` để kiểm tra sự tồn tại
  const result = await User.findAll({
    where: {
      [Op.or]: conditions,
    },
  });

  return result.length > 0;
}

async function createUser(userData) {
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(userData.password, saltRounds);

  // Sử dụng User.create để lưu trực tiếp vào cơ sở dữ liệu và nhận lại đối tượng đã lưu
  const newUser = new User({
    ...userData,
    password: hashedPassword,
    // refresh_token: userData.password,
  });
  // console.log({newUser});
  return newUser.save(); // newUser sẽ bao gồm tất cả các thuộc tính từ cơ sở dữ liệu
}

async function getUserByUserName(username) {
  return await User.findOne({
    where: { username: username }, // Loại bỏ refresh_token khỏi kết quả
  });
}

async function getUserByUserId(userId) {
  return await User.findOne({
    where: { id: userId },
    attributes: { exclude: ["refresh_token", "password"] }, // Loại bỏ refresh_token khỏi kết quả
  });
}

async function getUserByEmail(email) {
  // console.log(User.findOne({ where: { email: email } }));
  return await User.findOne({
    where: { email: email },
  });
}

async function validatePassword(password, hashedPassword) {
  // console.log(bcrypt.compareSync(password, hashedPassword))
  return await bcrypt.compare(password, hashedPassword);
}

async function updateRefreshToken(username, refreshToken) {
  try {
    const result = await User.update(
      {
        refresh_token: refreshToken, // Lưu refresh token thay vì access token
      },
      { where: { username: username } }
    );
    return result[0] > 0; // Trả về true nếu có ít nhất một hàng được cập nhật, ngược lại trả về false
  } catch (error) {
    console.error("Error updating refresh token: ", error);
    return false;
  }
}

const updateUser = async (username, updatedData) => {
  // Tìm người dùng theo username
  const user = await User.findOne({ where: { username } });

  // Kiểm tra nếu người dùng tồn tại
  if (!user) {
    throw new Error("User not found");
  }

  // Cập nhật thông tin người dùng
  Object.assign(user, updatedData);
  await user.save(); // Lưu cập nhật vào cơ sở dữ liệu

  return user;
};

const deleteUser = async (username) => {
  try {
    // Kiểm tra xem người dùng có tồn tại trong cơ sở dữ liệu không
    const user = await User.findOne({ where: { username } });
    if (!user) {
      throw new Error("User not found");
    }

    // Thực hiện xóa người dùng
    await User.destroy({
      where: { username },
    });

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

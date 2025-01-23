const { isUserExists } = require("../services/user.service");

// SignUp kiểm tra xem người dùng đã tồn tại chưa
const checkUserExistsSignUp = async (req, res, next) => {
  try {
    const { email, phone, username } = req.body;
    const userExists = await isUserExists({ email, phone, username });

    if (userExists) {
      return res
        .status(400)
        .send(
          "User with the provided email, phone number, or username already exists"
        );
    }
    next();
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .send("An error occurred while checking for existing user!");
  }
};
// Kiểm tra người dùng muốn đăng nhập có tồn tại chưa
const checkUserExistLogin = async (req, res, next) => {
  try {
    const { email } = req.body;
    const userExists = await isUserExists({ email });
    if (!userExists) {
      return res.status(404).send("User does not exist!");
    }
    next();
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .send("An error occurred while checking for existing user!");
  }
};

module.exports = {
  checkUserExistsSignUp,
  checkUserExistLogin,
};

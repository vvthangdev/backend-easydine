// SignUp kiểm tra tính hợp lệ của dữ liệu đầu vào

const validateSignUpSignUp = (req, res, next) => {
  const { role, name, address, bio, email, phone, username, password } =
    req.body;

  if (!name || !email || !phone || !username || !password) {
    return res.status(400).send("Empty input fields!");
  } else if (!/^[a-zA-Z ]*$/.test(name.trim())) {
    return res.status(400).send("Invalid name entered");
  } else if (!/^[\w\.\-]+@([\w\-]+\.)+[\w\-]{2,4}$/.test(email.trim())) {
    return res.status(400).send("Invalid email entered");
  } else if (password.trim().length < 8) {
    return res.status(400).send("Password is too short!");
  }

  next(); // Chuyển tiếp nếu dữ liệu hợp lệ
};

module.exports = {
  validateSignUpSignUp,
};
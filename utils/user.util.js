// SignUp kiểm tra tính hợp lệ của dữ liệu đầu vào

const validateSignUpSignUp = (req, res, next) => {
  const {  name, email, username, password } =
    req.body;
  if (!email || !username || !password) {
    return res.status(400).send("Empty input fields!");
  } else if (!/^[a-zA-ZÀ-ỹ ]*$/.test(name.trim())) {
    return res.status(400).send("Invalid name entered");
  } else if (!/^[\w\.\-]+@([\w\-]+\.)+[\w\-]{2,4}$/.test(email.trim())) {
    return res.status(400).send("Invalid email entered");
  } else if (password.trim().length < 8) {
    return res.status(400).send("Password is too short!");
  }
  next();
};

module.exports = {
  validateSignUpSignUp,
};

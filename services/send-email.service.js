const nodemailer = require("nodemailer");

// Cấu hình Nodemailer sử dụng SMTP của Gmail
const transporter = nodemailer.createTransport({
  service: "gmail", // Dịch vụ Gmail
  host: "smtp.gmail.com", // SMTP server của Gmail
  port: 465, // Cổng SMTP SSL của Gmail
  secure: true, // Dùng kết nối an toàn (SSL)
  auth: {
    user: process.env.EMAIL_USER, // Email người gửi (được lưu trong .env)
    pass: process.env.EMAIL_PASS, // Mật khẩu email người gửi hoặc App Password (được lưu trong .env)
  },
});

// Hàm gửi email xác nhận đơn hàng
const sendOrderConfirmationEmail = async (email, name, order) => {
  // Cấu trúc email với thiết kế hiện đại
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Order Confirmation",
    html: `
        <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
          <div style="max-width: 600px; margin: auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h2 style="color: #333;">Hello ${name},</h2>
            <p style="color: #555;">Thank you for your order! We are excited to let you know that your order has been successfully created.</p>
            <h3 style="color: #333;">Order Details:</h3>
            <ul style="list-style-type: none; padding-left: 0;">
              <li style="padding: 10px; border-bottom: 1px solid #eee;">
                <strong>Order ID:</strong> ${order.id}
              </li>
              <li style="padding: 10px; border-bottom: 1px solid #eee;">
                <strong>Number of people:</strong> ${order.num_people}
              </li>
              <li style="padding: 10px; border-bottom: 1px solid #eee;">
                <strong>Time:</strong> ${order.time}
              </li>
            </ul>
            <p style="color: #555;">If you have any questions, feel free to contact us.</p>
            <p style="color: #888;">Thank you for choosing us!</p>
            <footer style="margin-top: 20px; text-align: center; color: #aaa;">
              &copy; ${new Date().getFullYear()} Your Company Name. All rights reserved.
            </footer>
          </div>
        </div>
      `,
  };

  // Gửi email
  try {
    await transporter.sendMail(mailOptions);
    console.log("Order confirmation email sent successfully.");
  } catch (error) {
    console.error("Error sending confirmation email:", error);
    throw error;
  }
};

module.exports = {
  sendOrderConfirmationEmail,
};

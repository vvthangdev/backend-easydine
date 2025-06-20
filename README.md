# EasyDine Backend

![Node.js](https://img.shields.io/badge/Node.js-18.x-green)
![MongoDB](https://img.shields.io/badge/MongoDB-6.x-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

**EasyDine Backend** là API server cho ứng dụng EasyDine, được xây dựng bằng **Node.js**, **Express**, và **MongoDB**. Hướng dẫn này giúp bạn cài đặt và chạy backend trên máy local (Windows, macOS, hoặc Linux) mà không cần Docker. Mã nguồn được giả định đã giải nén từ file zip.

## Mục Lục
- [Yêu Cầu Hệ Thống](#yêu-cầu-hệ-thống)
- [Cài Đặt](#cài-đặt)
- [Chạy Ứng Dụng](#chạy-ứng-dụng)
- [Kiểm Tra Kết Quả](#kiểm-tra-kết-quả)
- [Lưu Ý](#lưu-ý)
- [Khắc Phục Lỗi](#khắc-phục-lỗi)

## Yêu Cầu Hệ Thống
- **Hệ điều hành**: Windows, macOS, hoặc Linux
- **Node.js**: Phiên bản 16 hoặc cao hơn (khuyến nghị 18.x)
- **npm**: Đi kèm với Node.js
- **MongoDB**: Kết nối đến server MongoDB từ xa hoặc local
- **Ngrok**: Để tạo tunnel cho VNPay
- **Trình chỉnh sửa văn bản**: VS Code hoặc tương tự

## Cài Đặt

1. **Cài Đặt Node.js**  
   Tải và cài đặt Node.js từ [nodejs.org](https://nodejs.org/en/download/) (chọn phiên bản LTS hoặc Current). Kiểm tra phiên bản bằng lệnh:  
   node --version  
   npm --version  
   Đảm bảo Node.js phiên bản 16 hoặc cao hơn.

2. **Chuẩn Bị Mã Nguồn**  
   Giải nén file zip chứa mã nguồn vào một thư mục, ví dụ: `C:\be-EasyDine` (Windows) hoặc `~/be-EasyDine` (macOS/Linux). Mở terminal và di chuyển vào thư mục:  
   cd /đường/dẫn/đến/be-EasyDine

3. **Cài Đặt Phụ Thuộc**  
   Chạy lệnh để cài đặt các thư viện cần thiết (Express, Mongoose, Passport, v.v.):  
   npm install

4. **Thiết Lập Biến Môi Trường**  
   Tạo file `.env` trong thư mục gốc (`be-EasyDine`) và sao chép nội dung sau:  
   PORT=8080  
   MONGO_URI=mongodb://aris:thang.vv215643@128.199.246.55:27017/easydine?replicaSet=rs0  
   ACCESS_TOKEN_SECRET="Access_Token_Secret_#$%_ExpressJS_Authentication"  
   ACCESS_TOKEN_LIFE=300d  
   REFRESH_TOKEN_SECRET="Refresh_Token_Secret_#$%_ExpressJS_Authentication"  
   REFRESH_TOKEN_LIFE=150d  
   END_TIME_OFFSET_MINUTES=120  
   BUFFER_TIME=15  
   RESERVATION_DURATION_MINUTES=240  
   RESERVATION_TABLE_DURATION_MINUTES=180  
   EMAIL_USER=vvthang.demo@gmail.com  
   EMAIL_PASS=ygdykxfaizvbhkfd  
   GOOGLE_CLIENT_ID=355702919962-mrndc8uvaq3asakk24dmp5smsii7tiic.apps.googleusercontent.com  
   GOOGLE_CLIENT_SECRET=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  
   GOOGLE_CALLBACK_URL=http://localhost:8080/users/auth/google/callback  
   SESSION_SECRET="Session_Secret_ExpressJS_Auth_@#_SecureKey"  
   FRONTEND_URL="http://localhost:3000"  
   VNPAY_TMN_CODE=3DCEJCVE  
   VNPAY_HASH_SECRET=3S7BZYQW1FUJWUDEID8VLTMJWS6Z3HHK  
   VNPAY_RETURN_URL="https://<your-ngrok-url>/orders/payment-return"  
   VNPAY_IPN_URL="https://<your-ngrok-url>/orders/payment-ipn"  
   - **Cấu hình Ngrok**: Cài Ngrok từ [ngrok.com](https://ngrok.com/download). Chạy lệnh:  
     ngrok http 8080  
     Lấy URL từ Ngrok (ví dụ: `https://abc123.ngrok-free.app`) và cập nhật `VNPAY_RETURN_URL` và `VNPAY_IPN_URL` trong `.env`:  
     VNPAY_RETURN_URL=https://abc123.ngrok-free.app/orders/payment-return  
     VNPAY_IPN_URL=https://abc123.ngrok-free.app/orders/payment-ipn  
   - **MongoDB local (tùy chọn)**: Nếu muốn dùng MongoDB local, cài MongoDB Community Edition từ [mongodb.com](https://www.mongodb.com/try/download/community). Thay `MONGO_URI` trong `.env`:  
     MONGO_URI=mongodb://localhost:27017/easydine  
     Chạy MongoDB:  
     mongod

## Chạy Ứng Dụng
Trong terminal, tại thư mục dự án, chạy:  
npm start  
Hoặc nếu dự án dùng `nodemon`:  
npm run dev  
Backend sẽ chạy trên `http://localhost:8080`.

## Kiểm Tra Kết Quả
1. Dùng Postman hoặc trình duyệt, thử truy cập các endpoint:  
   - `http://localhost:8080/users/auth/google` (đăng nhập Google).  
   - `http://localhost:8080/api/health` (nếu có endpoint kiểm tra).  
2. Kiểm tra terminal để xem log lỗi.

## Lưu Ý
- **Bảo mật**: File `.env` chứa thông tin nhạy cảm như `EMAIL_PASS`, `GOOGLE_CLIENT_SECRET`. Không chia sẻ công khai.
- **Kết nối mạng**: Đảm bảo máy local kết nối được với MongoDB từ xa (`128.199.246.55:27017`) hoặc MinIO (nếu dùng).
- **Script chạy**: Kiểm tra file `package.json` để xác nhận script `start` hoặc `dev` tồn tại.
- **Lỗi phụ thuộc**: Nếu lỗi khi chạy `npm install`, xóa thư mục `node_modules` và file `package-lock.json`, rồi chạy lại `npm install`.

## Khắc Phục Lỗi
- **Lỗi MongoDB**: Kiểm tra `MONGO_URI`, đảm bảo server từ xa (`128.199.246.55:27017`) hoạt động hoặc dùng MongoDB local.
- **Lỗi VNPay**: Xác minh Ngrok đang chạy và URL trong `.env` khớp với URL Ngrok.
- **Lỗi khác**: Cung cấp log lỗi trong terminal để được hỗ trợ chi tiết.
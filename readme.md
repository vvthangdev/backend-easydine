BackEnd:
Các package cần cài đặt:
npm install nodemon express sequelize mysql2 dotenv bcrypt jsonwebtoken rand-token

chạy server:
npm run dev

sql: cài đặt tài khoản, mật khẩu trong file .env

Bỏ comment dòng //initModel trong app.js để đồng bộ hóa db, nếu lỗi xóa các bảng trong db rồi chạy lại backend

MySQL:
CREATE TABLE users (
id INT AUTO_INCREMENT PRIMARY KEY,
role ENUM('CUSTOMER', 'ADMIN') NOT NULL DEFAULT 'CUSTOMER',
name VARCHAR(255) NOT NULL,
address VARCHAR(255),
avatar varchar(255),
bio TEXT,
email VARCHAR(255) UNIQUE,
username VARCHAR(50) UNIQUE,
phone VARCHAR(20),
password VARCHAR(255) NOT NULL,
refresh_token VARCHAR(255)
);

//Bỏ cột trạng thái bàn, thêm cột số bàn
CREATE TABLE table_info (
table_number INT PRIMARY KEY,
capacity INT NOT NULL
)

create table order_detail(
id int primary key auto_increment,
customer_id int not null,
time timestamp default current_timestamp,
type enum('reservation', 'ship') not null,
status enum('pending', 'confirmed', 'canceled') DEFAULT 'pending',
foreign key(customer_id) references user(id) on delete cascade
);

//Thêm trường thời gian bắt đầu và kết thúc
CREATE TABLE reservation_table (
id INT PRIMARY KEY AUTO_INCREMENT,
reservation_id INT NOT NULL, -- Liên kết đến bảng `order_detail`
table_id INT NOT NULL, -- Liên kết đến bảng `table_info`
start_time DATETIME NOT NULL, -- Thời gian bắt đầu đặt bàn
end_time DATETIME NOT NULL, -- Thời gian kết thúc đặt bàn
FOREIGN KEY (reservation_id) REFERENCES order_detail(id) ON DELETE CASCADE,
FOREIGN KEY (table_id) REFERENCES table_info(table_number) ON DELETE CASCADE
);

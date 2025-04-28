# Sử dụng image Node.js phiên bản 18
FROM node:18

# Tạo thư mục làm việc
WORKDIR /usr/src/app

# Sao chép package.json và package-lock.json
COPY package.json package-lock.json ./

# Cài đặt phụ thuộc
RUN npm install

# Sao chép mã nguồn
COPY . .

# Mở cổng 8080
EXPOSE 8080

# Lệnh khởi động ứng dụng
CMD ["npm", "start"]

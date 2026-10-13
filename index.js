// Nạp .env TRƯỚC mọi module khác (auth đọc JWT_SECRET ngay khi được require)
require('dotenv').config();
if (!process.env.JWT_SECRET) {
    console.error('Thiếu biến môi trường JWT_SECRET. Xem .env');
    process.exit(1);
}

const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const http = require("http");
const { init } = require("./socket");

// Import app từ ./app
const { app } = require("./app");
const config = require("./config/env");
const connectDB = require("./config/db");

// 💥 IMPORT JOB TẠI ĐÂY
const { startNoteReminderJob } = require("./jobs/noteReminderJob");

const server = http.createServer(app);

// Khởi tạo Socket.IO hỗ trợ tất cả các nguồn
const io = init(server);

// Gán instance io vào app Express
app.set("io", io);

const startServer = async () => {
    try {
        await connectDB();
        server.listen(config.port, () => {
            console.log("Server is running on port " + config.port);

            // 💥 KÍCH HOẠT CRON JOB TẠI ĐÂY SAU KHI SERVER CHẠY
            startNoteReminderJob();
        });
    } catch (error) {
        console.log(error.message);
        process.exit(1);
    }
};

startServer();
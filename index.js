const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const http = require("http");
const { init } = require("./socket");

// SỬA TẠI ĐÂY: Import app và allowedOrigins từ ./app
const { app, allowedOrigins } = require("./app");
const config = require("./config/env");
const connectDB = require("./config/db");

const server = http.createServer(app);

// Khởi tạo Socket.IO với allowedOrigins được lấy từ app.js
init(server, allowedOrigins);

const startServer = async () => {
    try {
        await connectDB();
        // Dùng server.listen để kích hoạt cả Express và Socket.IO
        server.listen(config.port, () => {
            console.log("Server is running on port " + config.port);
        });
    } catch (error) {
        console.log(error.message);
        process.exit(1);
    }
};

startServer();
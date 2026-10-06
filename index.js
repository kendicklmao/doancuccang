const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const http = require("http");
const { init } = require("./socket");

// Import app và allowedOrigins từ ./app
const { app, allowedOrigins } = require("./app");
const config = require("./config/env");
const connectDB = require("./config/db");

const server = http.createServer(app);

// Khởi tạo Socket.IO với allowedOrigins
const io = init(server, allowedOrigins);

// ✅ SỬA TẠI ĐÂY: Gán instance io vào app Express để req.app.get('io') ở controller lấy được
app.set("io", io);

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
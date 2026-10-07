// socket.js
const { Server } = require("socket.io");

let io;

module.exports = {
    init: (httpServer) => {
        io = new Server(httpServer, {
            cors: {
                origin: "*", // ✅ Cho phép tất cả IP / Cổng kết nối
                methods: ["GET", "POST"],
                credentials: true,
            },
        });

        io.on("connection", (socket) => {
            console.log("⚡ Client connected:", socket.id);

            // 🎯 Cho user vào Room riêng dựa theo ID (Phục vụ việc Ban/Kick tài khoản)
            socket.on("join_user", (userId) => {
                if (userId) {
                    socket.join(`user_${userId}`);
                    console.log(`Socket ${socket.id} joined user room: user_${userId}`);
                }
            });

            // Tham gia vào room của dự án (mỗi project 1 room riêng)
            socket.on("join_project", (projectId) => {
                socket.join(`project_${projectId}`);
                console.log(`Socket ${socket.id} joined project_${projectId}`);
            });

            // Rời room dự án
            socket.on("leave_project", (projectId) => {
                socket.leave(`project_${projectId}`);
                console.log(`Socket ${socket.id} left project_${projectId}`);
            });

            socket.on("disconnect", () => {
                console.log("🔥 Client disconnected:", socket.id);
            });
        });

        return io;
    },
    getIO: () => {
        if (!io) {
            throw new Error("Socket.io chưa được khởi tạo!");
        }
        return io;
    },
};
// socket.js
const { Server } = require("socket.io");

let io;

module.exports = {
    init: (httpServer, allowedOrigins) => {
        io = new Server(httpServer, {
            cors: {
                origin: allowedOrigins,
                credentials: true,
            },
        });

        io.on("connection", (socket) => {
            console.log("⚡ Client connected:", socket.id);

            // Tham gia vào room của dự án (mỗi project 1 room riêng)
            socket.on("join_project", (projectId) => {
                socket.join(`project_${projectId}`);
                console.log(`Socket ${socket.id} joined project_${projectId}`);
            });

            // Rời room
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
// socket.js — Socket.IO dùng chung: MỘT room chung cho toàn bộ ứng dụng, chỉ client đã xác thực mới được vào.
// Socket chỉ là kênh đồng bộ; REST + MongoDB vẫn là nguồn dữ liệu chính thức.
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("./model/user");

// Tên room chung cố định (server tự join, client không được chọn room).
const GLOBAL_ROOM = "app_global_room";

let io;

// Xác thực handshake bằng cùng JWT như REST (verifyToken): token trong handshake.auth.token.
// Chỉ đọc secret từ env; không có fallback cứng cho socket.
async function authenticateSocket(socket, next) {
    try {
        const secret = process.env.JWT_SECRET;
        if (!secret) return next(new Error("AUTH_UNAVAILABLE"));

        const raw = socket.handshake?.auth?.token;
        const token = typeof raw === "string" ? raw.replace(/^Bearer\s+/i, "").trim() : "";
        if (!token) return next(new Error("AUTH_REQUIRED"));

        const decoded = jwt.verify(token, secret);
        const userId = String(decoded.id || decoded._id || "");
        if (!userId) return next(new Error("AUTH_INVALID"));

        const user = await User.findById(userId);
        if (!user) return next(new Error("AUTH_INVALID"));
        if (user.status === "Inactive") return next(new Error("ACCOUNT_SUSPENDED"));

        // userId lấy từ token đã verify, không bao giờ từ client.
        socket.data.userId = userId;
        return next();
    } catch (err) {
        return next(new Error("AUTH_INVALID"));
    }
}

// SOCKET_CORS_ORIGINS="http://a,http://b" để siết CORS; mặc định "*" khớp CORS của REST (app.js).
// Không dùng cookie: xác thực bằng token trong handshake.
function resolveCorsOrigin() {
    const list = (process.env.SOCKET_CORS_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
    return list.length ? list : "*";
}

function init(httpServer) {
    io = new Server(httpServer, {
        cors: { origin: resolveCorsOrigin(), methods: ["GET", "POST"] },
    });

    io.use(authenticateSocket);

    io.on("connection", (socket) => {
        socket.join(GLOBAL_ROOM); // room duy nhất, do server quyết định
    });

    return io;
}

function getIO() {
    if (!io) {
        throw new Error("Socket.io chưa được khởi tạo!");
    }
    return io;
}

// Phát sự kiện tới room chung SAU khi thao tác DB đã thành công.
// Không bao giờ ném lỗi: socket hỏng/chưa khởi tạo không được làm sai kết quả REST.
function emitToApp(event, payload) {
    try {
        getIO().to(GLOBAL_ROOM).emit(event, payload);
    } catch (err) {
        console.error(`Socket emit error (${event}):`, err.message);
    }
}

// Ngắt mọi socket đang mở của một user (ví dụ khi bị khóa tài khoản).
async function disconnectUser(userId) {
    try {
        const sockets = await getIO().in(GLOBAL_ROOM).fetchSockets();
        sockets
            .filter((s) => s.data && s.data.userId === String(userId))
            .forEach((s) => s.disconnect(true));
    } catch (err) {
        console.error("Socket disconnectUser error:", err.message);
    }
}

module.exports = { init, getIO, emitToApp, disconnectUser, authenticateSocket, GLOBAL_ROOM };

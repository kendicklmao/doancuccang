const express = require('express');
const userRouter = express.Router();
const controller = require('./../controller/user');
// Import verifyToken và checkRole từ middleware auth mới
const { verifyToken, checkRole } = require('../middleware/auth');
const { emitOnSuccess, str } = require('../middleware/realtime');

// 1. Auth public (Không cần đăng nhập)
userRouter.post('/register', emitOnSuccess("user_created", () => ({})), controller.register);
userRouter.post('/login', controller.login);
// Forgot password by email OTP (public) and change password (logged in). Declared before the /:id routes.
userRouter.post('/forgot-password/request', controller.requestPasswordOtp);
userRouter.post('/forgot-password/verify', controller.verifyPasswordOtp);
userRouter.post('/change-password', verifyToken, controller.changePassword);

// 2. Lấy thông tin user hiện tại đang đăng nhập
userRouter.get('/currentUser', verifyToken, controller.GetCurrentUser);

// 3. Quản lý danh sách người dùng: Chỉ dành cho Manager
userRouter.get('/', verifyToken, checkRole([]), controller.getUsers);

// 4. Xóa người dùng: Chỉ dành cho Manager
userRouter.delete('/:id', verifyToken,checkRole([]), emitOnSuccess("user_deleted", (req) => ({ userId: str(req.params.id) })),controller.deleteUser);

// 5. Lấy thông tin chi tiết 1 người dùng theo ID
userRouter.get('/:id', controller.getUserById);
userRouter.post('/check-email',controller.CheckEmail);
userRouter.post('/reset-password',controller.resetPassword);
userRouter.put('/:id', emitOnSuccess("user_updated", (req) => ({ userId: str(req.params.id) })), controller.updateUser);

userRouter.post("/send-otp", controller.sendOtp);
module.exports = userRouter;
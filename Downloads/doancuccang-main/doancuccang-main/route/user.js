const express = require('express');
const userRouter = express.Router();
const controller = require('./../controller/user');
// Import verifyToken và checkRole từ middleware auth mới
const { verifyToken, checkRole } = require('../middleware/auth');

// 1. Auth public (Không cần đăng nhập)
userRouter.post('/register', controller.register);
userRouter.post('/login', controller.login);

// 2. Lấy thông tin user hiện tại đang đăng nhập
userRouter.get('/currentUser', verifyToken, controller.GetCurrentUser);

// 3. Quản lý danh sách người dùng: Chỉ dành cho Manager
userRouter.get('/', controller.getUsers);

// 4. Xóa người dùng: Chỉ dành cho Manager
userRouter.delete('/:id', verifyToken, checkRole(['Manager']), controller.deleteUser);

// 5. Lấy thông tin chi tiết 1 người dùng theo ID
userRouter.get('/:id', verifyToken, controller.getUserById);

module.exports = userRouter;
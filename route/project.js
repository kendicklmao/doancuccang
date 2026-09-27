const express = require("express");
const projectRouter = express.Router();
const controller = require("./../controller/project");
// Destructuring verifyToken và checkRole từ middleware auth mới
const { verifyToken, checkRole } = require('../middleware/auth');

// 1. Tạo dự án mới: Chỉ dành cho Manager
projectRouter.post("/", verifyToken, checkRole(['Manager']), controller.createProject);

// 2. Lấy danh sách dự án: Tất cả user đăng nhập đều xem được
projectRouter.get("/", verifyToken, controller.getProject);

// 3. Lấy thông tin dự án theo ID: Tất cả user đăng nhập đều xem được
projectRouter.get("/:id", verifyToken, controller.getProjectById);

// 4. Xóa dự án: Chỉ dành cho Manager
projectRouter.delete("/:id", verifyToken, checkRole(['Manager']), controller.deleteProject);

// 5. Cập nhật dự án: Chỉ dành cho Manager
projectRouter.put("/:id", verifyToken, checkRole(['Manager']), controller.updateProject);

// 6. Lấy danh sách thành viên dự án: Tất cả user đăng nhập đều xem được
projectRouter.get("/:id/assignees", verifyToken, controller.getProjectAssignees);

// 7. Xóa thành viên khỏi dự án: Chỉ dành cho Manager
projectRouter.delete("/:id/assignees/:memberUserId", verifyToken, checkRole(['Manager']), controller.removeProjectAssignee);

module.exports = projectRouter;
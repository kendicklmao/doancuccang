const express = require("express");
const projectRouter = express.Router();
const controller = require("./../controller/project");
// Destructuring verifyToken và checkRole từ middleware auth mới
const { verifyToken, checkRole } = require('../middleware/auth');
const upload = require("../middleware/file");
const { emitOnSuccess, str } = require('../middleware/realtime');
projectRouter.get('/portfolio',verifyToken,controller.Portfolio);

// 1. Tạo dự án mới: Chỉ dành cho Manager
projectRouter.post("/", verifyToken, checkRole([]), emitOnSuccess("project_created", (req, b) => ({ projectId: str(b?.project) })),controller.createProject);

// 2. Lấy danh sách dự án: Tất cả user đăng nhập đều xem được
projectRouter.get("/", verifyToken, controller.getProject);

// 3. Lấy thông tin dự án theo ID: Tất cả user đăng nhập đều xem được
projectRouter.get("/:id", verifyToken, controller.getProjectById);

// 4. Xóa dự án: Chỉ dành cho Manager
projectRouter.delete("/:id", verifyToken, checkRole([]), emitOnSuccess("project_deleted", (req) => ({ projectId: str(req.params.id) })),controller.deleteProject);

// 5. Cập nhật dự án: Chỉ dành cho Manager
projectRouter.put("/:id", verifyToken, checkRole(["Manager"]), emitOnSuccess("project_updated", (req) => ({ projectId: str(req.params.id) })),controller.updateProject);

// 6. Lấy danh sách thành viên dự án: Tất cả user đăng nhập đều xem được
projectRouter.get("/:id/assignees", verifyToken, controller.getProjectAssignees);

// 7. Xóa thành viên khỏi dự án: Chỉ dành cho Manager
projectRouter.delete("/:id/assignees/:memberUserId", verifyToken, checkRole(["Manager"]), emitOnSuccess("member_removed", (req) => ({ projectId: str(req.params.id), userId: str(req.params.memberUserId) })),controller.removeProjectAssignee);

projectRouter.put('/:id/project-detail', verifyToken, checkRole(["Manager"]), emitOnSuccess("project_updated", (req) => ({ projectId: str(req.params.id) })),controller.updateProjectDetail);

projectRouter.post("/:id/documents/upload", verifyToken, upload.array('files', 10), checkRole(["Manager"]), emitOnSuccess("project_updated", (req) => ({ projectId: str(req.params.id) })),controller.uploadProjectDocument);

projectRouter.delete("/:id/documents/:documentId", verifyToken, checkRole(["Manager"]), emitOnSuccess("project_updated", (req) => ({ projectId: str(req.params.id) })),controller.removeProjectDocument);

module.exports = projectRouter;
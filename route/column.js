const express = require("express");
const columnRouter = express.Router();
const controller = require("./../controller/column");
// Import destructuring từ middleware auth mới
const { verifyToken, checkRole } = require('../middleware/auth');

// 1. Tạo cột mới: Chỉ dành cho Manager
columnRouter.post("/", verifyToken, checkRole([]),controller.createColumn);

// 2. Lấy danh sách cột: Cần verifyToken (Member, Leader, Manager đều xem được)
columnRouter.get("/", verifyToken, controller.getColumn);

// 3. Lấy cột theo ID: Cần verifyToken
columnRouter.get("/:id", verifyToken, controller.getColumnById);

// 4. Lấy danh sách cột theo Project ID: Cần verifyToken
columnRouter.get("/project/:projectId", verifyToken, controller.getColumnsByProject);

module.exports = columnRouter;
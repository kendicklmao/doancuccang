const express = require('express');
const taskRouter = express.Router();
const controller = require('./../controller/task');
// Import verifyToken và checkRole từ middleware auth mới
const { verifyToken, checkRole } = require('../middleware/auth');

// 1. Tạo task mới (Add Task): Chỉ dành cho Manager
taskRouter.post('/', verifyToken, controller.createTask);

// 2. Xóa task: Chỉ dành cho Manager
taskRouter.delete('/:id', verifyToken, controller.deleteTask);

// 3. Cập nhật task (VD: Chọn Assignee, sửa thông tin): Chỉ dành cho Leader
taskRouter.put('/:id', verifyToken, controller.updateTask);

// 4. Di chuyển task (Push to Board / Kéo thả): Chỉ dành cho Leader
taskRouter.put('/:id/move', verifyToken, controller.moveTask);

// ------------------- CÁC ROUTE XEM & TƯƠNG TÁC CHUNG (Member, Leader, Manager) -------------------

// Lấy danh sách task (Filter query)
taskRouter.get('/', verifyToken, controller.getTask);
taskRouter.get('/my-task',verifyToken,controller.getMyTasks);

// Lấy thông tin task theo ID
taskRouter.get('/:id', verifyToken, controller.getTaskById);

// Lấy danh sách task theo Project ID
taskRouter.get('/project/:id', verifyToken, controller.getTasksByProject);

// Thêm mục checklist
taskRouter.post('/:id/checklist', verifyToken, controller.addChecklistItem);

// Toggle hoàn thành mục checklist
taskRouter.post('/:id/checklist/:itemId', verifyToken, controller.toggleChecklistItem);

// Lấy danh sách comment của task
taskRouter.get('/:id/comments', verifyToken, controller.getTaskComments);

// Thêm comment mới vào task
taskRouter.post('/:id/comments', verifyToken, controller.addComment);

// Lấy lịch sử hoạt động (Activity) của task
taskRouter.get('/:id/activity', verifyToken, controller.getTaskActivities);

taskRouter.delete('/:id/checklist/:itemId', verifyToken, controller.deleteChecklist);

taskRouter.get('/project/:projectId/tasks-by-week', verifyToken, controller.getTaskCountByWeek);

taskRouter.get('/project/:projectId/tasks-by-status', verifyToken, controller.getTaskCountByStatus);

module.exports = taskRouter;
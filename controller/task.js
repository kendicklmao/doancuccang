const Task = require('./../model/task');
const Column = require('./../model/column');
const Project = require('./../model/project');
const Comment = require('../model/Comment');
const TaskActivity = require('../model/activity');

// Helper function dùng để ghi log hoạt động ngắn gọn
const logActivity = async (taskId, userId, action, details = null) => {
    try {
        if (!taskId || !userId) return;
        await TaskActivity.create({
            taskId,
            user: userId,
            action,
            details
        });
    } catch (err) {
        console.error('Lỗi khi lưu TaskActivity:', err.message);
    }
};

exports.getTask = async (req, res) => {
    try {
        const { columnId } = req.query;
        let filter = {};
        if (columnId) {
            filter.columnId = columnId;
        }
        const tasks = await Task.find(filter).sort('position');
        res.json(tasks);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getTaskById = async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ message: 'not found' });
        }
        res.json(task);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getTasksByProject = async (req, res) => {
    try {
        const projectId = req.query.projectId || req.params.projectId || req.params.id;

        if (!projectId) {
            return res.status(400).json({ message: 'Thiếu projectId' });
        }

        const columns = await Column.find({ projectId }).select('_id name position');

        if (!columns || columns.length === 0) {
            return res.status(200).json([]);
        }

        const columnIds = columns.map(col => col._id);

        const tasks = await Task.find({ columnId: { $in: columnIds } })
            .populate('assignees', 'username email')
            .populate('columnId', 'name position projectId');

        res.status(200).json(tasks);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createTask = async (req, res) => {
    try {
        const { title, description, columnId, projectId, assignees, priority, date } = req.body;
        const currentUserId = req.user.id || req.user._id;

        if (!title || !title.trim()) {
            return res.status(400).json({ message: 'Task title is required' });
        }

        let targetColumnId = columnId;

        if (!targetColumnId && projectId) {
            const firstColumn = await Column.findOne({ projectId }).sort('position');
            if (firstColumn) {
                targetColumnId = firstColumn._id;
            }
        }

        if (!targetColumnId) {
            return res.status(400).json({ message: 'Please select a column' });
        }

        const column = await Column.findById(targetColumnId);
        if (!column) {
            return res.status(404).json({ message: 'Selected column does not exist' });
        }

        const project = await Project.findOne({ _id: column.projectId, userId: currentUserId });
        if (!project) {
            return res.status(403).json({ message: 'Unauthorized: You do not own this project' });
        }

        const taskAssignees = Array.isArray(assignees) ? assignees : [];

        const newTask = new Task({
            title: title.trim(),
            description: description || '',
            columnId: targetColumnId,
            assignees: taskAssignees,
            priority: priority || 'Medium',
            date: date || null
        });

        await newTask.save();

        column.taskOrderIds.push(newTask._id);
        await column.save();

        // Log hoạt động tạo task
        await logActivity(newTask._id, currentUserId, 'đã tạo task này');

        res.status(201).json({
            message: 'Task created successfully',
            task: newTask
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// 🟢 CẬP NHẬT TASK (SỬA TÊN, MÔ TẢ, TRẠNG THÁI, DÙNG TRONG DRAWER)
exports.updateTask = async (req, res) => {
    try {
        const taskId = req.params.id;
        const currentUserId = req.user.id || req.user._id;

        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        const column = await Column.findById(task.columnId);
        const project = await Project.findOne({ _id: column.projectId, userId: currentUserId });
        if (!project) {
            return res.status(403).json({ message: 'Unauthorized to update this task' });
        }

        const updatedTask = await Task.findByIdAndUpdate(
            taskId,
            req.body,
            { new: true, runValidators: true }
        );

        // Ghi log chi tiết tùy theo nội dung thay đổi
        if (req.body.title && req.body.title !== task.title) {
            await logActivity(taskId, currentUserId, `đã đổi tên task thành "${req.body.title}"`);
        } else if (req.body.columnId && req.body.columnId.toString() !== task.columnId.toString()) {
            const targetCol = await Column.findById(req.body.columnId);
            await logActivity(taskId, currentUserId, `đã chuyển task sang cột "${targetCol?.name || 'mới'}"`);
        } else if (req.body.priority && req.body.priority !== task.priority) {
            await logActivity(taskId, currentUserId, `đã đổi mức độ ưu tiên thành ${req.body.priority}`);
        } else if (req.body.description !== undefined && req.body.description !== task.description) {
            await logActivity(taskId, currentUserId, 'đã cập nhật mô tả task');
        } else {
            await logActivity(taskId, currentUserId, 'đã cập nhật thông tin task');
        }

        res.json(updatedTask);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.deleteTask = async (req, res) => {
    try {
        const taskId = req.params.id;
        const currentUserId = req.user.id || req.user._id;

        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        const column = await Column.findById(task.columnId);
        const project = await Project.findOne({ _id: column.projectId, userId: currentUserId });
        if (!project) {
            return res.status(403).json({ message: 'Unauthorized to delete this task' });
        }

        await Task.findByIdAndDelete(taskId);

        if (column) {
            column.taskOrderIds = column.taskOrderIds.filter(id => id.toString() !== taskId);
            await column.save();
        }

        // Xóa tất cả activity liên quan đến task này
        await TaskActivity.deleteMany({ taskId });

        res.json({ message: 'Task deleted successfully', id: taskId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// 🟢 DI CHUYỂN TASK (KÉO THẢ KANBAN BOARD)
exports.moveTask = async (req, res) => {
    try {
        const taskId = req.params.id;
        const { sourceColumnId, destColumnId, destinationIndex } = req.body;
        const currentUserId = req.user?.id || req.user?._id;

        if (!currentUserId) {
            return res.status(401).json({ message: 'Không tìm thấy thông tin xác thực người dùng' });
        }

        const task = await Task.findById(taskId);
        if (!task) return res.status(404).json({ message: 'Task không tồn tại' });

        const isAssignee = task.assignees?.some(assignee => {
            if (!assignee) return false;
            const assigneeId = assignee._id ? assignee._id.toString() : assignee.toString();
            return assigneeId === currentUserId.toString();
        });

        if (!isAssignee) {
            return res.status(403).json({ message: 'Chỉ người được phân công (assignee) mới có quyền di chuyển task này' });
        }

        const sourceCol = await Column.findById(sourceColumnId);
        const destCol = await Column.findById(destColumnId);

        if (!sourceCol || !destCol) {
            return res.status(400).json({ message: 'Cột nguồn hoặc cột đích không hợp lệ' });
        }

        // 1. Kéo thả TRONG CÙNG 1 CỘT
        if (sourceColumnId.toString() === destColumnId.toString()) {
            const currentOrder = sourceCol.taskOrderIds.map(id => id.toString());
            const filteredOrder = currentOrder.filter(id => id !== taskId.toString());

            const validIndex = Math.max(0, Math.min(destinationIndex, filteredOrder.length));
            filteredOrder.splice(validIndex, 0, taskId);

            sourceCol.taskOrderIds = filteredOrder;
            await sourceCol.save();

            return res.status(200).json({
                message: 'Cập nhật vị trí thành công',
                taskId,
                destColumnId,
                taskOrderIds: sourceCol.taskOrderIds
            });
        }

        // 2. Kéo thả SANG CỘT KHÁC
        sourceCol.taskOrderIds = sourceCol.taskOrderIds.filter(id => id.toString() !== taskId.toString());

        const destOrder = destCol.taskOrderIds.map(id => id.toString());
        const validIndex = Math.max(0, Math.min(destinationIndex, destOrder.length));
        destOrder.splice(validIndex, 0, taskId);
        destCol.taskOrderIds = destOrder;

        task.columnId = destColumnId;

        await Promise.all([
            sourceCol.save(),
            destCol.save(),
            task.save()
        ]);

        // Ghi log hoạt động chuyển cột
        await logActivity(
            taskId,
            currentUserId,
            `đã chuyển task từ cột "${sourceCol.title || 'Cột cũ'}" sang "${destCol.title || 'Cột mới'}"`
        );

        return res.status(200).json({
            message: 'Cập nhật vị trí thành công',
            taskId,
            destColumnId,
            taskOrderIds: destCol.taskOrderIds
        });

    } catch (err) {
        console.error('Lỗi khi moveTask:', err);
        return res.status(500).json({ error: err.message || 'Lỗi hệ thống khi di chuyển task' });
    }
};

exports.toggleChecklistItem = async (req, res) => {
    try {
        const { id, itemId } = req.params;
        const currentUserId = req.user?.id || req.user?._id;

        const task = await Task.findById(id);
        if (!task) {
            return res.status(404).json({ message: 'Task không tồn tại' });
        }

        const item = task.checklist.find((chk, idx) =>
            String(chk._id) === String(itemId) || String(idx) === String(itemId)
        );

        if (!item) {
            return res.status(404).json({ message: 'Không tìm thấy checklist item' });
        }

        const newStatus = !item.completed;

        const updatedTask = await Task.findOneAndUpdate(
            { _id: id, "checklist._id": item._id },
            { $set: { "checklist.$.completed": newStatus } },
            { new: true }
        );

        // Ghi log checklist
        const actionMsg = newStatus
            ? `đã hoàn thành công việc "${item.text}"`
            : `đã đánh dấu chưa hoàn thành "${item.text}"`;
        await logActivity(id, currentUserId, actionMsg);

        return res.status(200).json(updatedTask);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

exports.addChecklistItem = async (req, res) => {
    try {
        const { id } = req.params;
        const { text } = req.body;
        const currentUserId = req.user?.id || req.user?._id;

        if (!text || !text.trim()) {
            return res.status(400).json({ message: 'Nội dung checklist không được để trống' });
        }

        const task = await Task.findByIdAndUpdate(
            id,
            { $push: { checklist: { text: text.trim(), completed: false } } },
            { new: true }
        );

        if (!task) {
            return res.status(404).json({ message: 'Task không tồn tại' });
        }

        await logActivity(id, currentUserId, `đã thêm mục checklist "${text.trim()}"`);

        return res.status(200).json(task);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

exports.getTaskComments = async (req, res) => {
    try {
        const { id } = req.params;
        const comments = await Comment.find({ taskId: id })
            .populate('user', 'username email name')
            .sort({ createdAt: 1 });

        return res.status(200).json(comments);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

exports.addComment = async (req, res) => {
    try {
        const { id } = req.params;
        const { text } = req.body;
        const userId = req.user.id || req.user._id;

        if (!text || !text.trim()) {
            return res.status(400).json({ message: 'Nội dung bình luận không được để trống' });
        }

        const newComment = new Comment({
            taskId: id,
            user: userId,
            text: text.trim()
        });

        await newComment.save();
        await newComment.populate('user', 'username email name');

        // Ghi log hoạt động khi thêm bình luận
        await logActivity(id, userId, 'đã thêm một bình luận');

        return res.status(201).json(newComment);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

exports.getTaskActivities = async (req, res) => {
    try {
        const taskId = req.params.taskId || req.params.id;

        const activities = await TaskActivity.find({ taskId })
            .populate('user', 'username name email avatar')
            .sort({ createdAt: -1 });

        return res.status(200).json(activities);
    } catch (error) {
        return res.status(500).json({
            message: 'Không thể lấy lịch sử hoạt động của task',
            error: error.message
        });
    }
};
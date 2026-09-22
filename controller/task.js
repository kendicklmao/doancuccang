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
        const columnIds = columns ? columns.map(col => col._id) : [];

        // LẤY CẢ TASK TRÊN BOARD (columnId thuộc columnIds) LẪN TASK TRONG BACKLOG (projectId và columnId = null)
        const tasks = await Task.find({
            $or: [
                { columnId: { $in: columnIds } },
                { projectId: projectId, columnId: null },
                { projectId: projectId, columnId: { $exists: false } }
            ]
        })
            .populate('assignees', 'username name email')
            .populate('columnId', 'name position projectId');

        res.status(200).json(tasks);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createTask = async (req, res) => {
    try {
        const { title, description, columnId, projectId, assignees, priority, date } = req.body;
        const currentUserId = req.user ? (req.user.id || req.user._id) : null;

        if (!title || !title.trim()) {
            return res.status(400).json({ message: 'Task title is required' });
        }

        if (!projectId) {
            return res.status(400).json({ message: 'Missing projectId' });
        }

        // Tạo object task cơ bản
        const taskData = {
            title: title.trim(),
            description: description || '',
            projectId: projectId,
            assignees: Array.isArray(assignees) ? assignees : [],
            priority: priority || 'Medium',
            date: date || new Date()
        };

        // CHỈ thêm columnId nếu thực sự có truyền (Task tạo trực tiếp trên Board)
        if (columnId) {
            const column = await Column.findById(columnId);
            if (!column) {
                return res.status(404).json({ message: 'Selected column does not exist' });
            }
            taskData.columnId = columnId;
        }

        // Lưu vào Database
        const newTask = new Task(taskData);
        await newTask.save();

        // Nếu có cột thì đẩy vào order
        if (columnId) {
            await Column.findByIdAndUpdate(columnId, {
                $push: { taskOrderIds: newTask._id }
            });
        }

        // Ghi log
        if (typeof logActivity === 'function' && currentUserId) {
            await logActivity(newTask._id, currentUserId, 'đã tạo task này').catch(() => {});
        }

        return res.status(201).json(newTask);

    } catch (err) {
        console.error("❌ Lỗi createTask Backend:", err);
        return res.status(500).json({ error: err.message });
    }
};

// 🟢 CẬP NHẬT TASK (SỬA TÊN, MÔ TẢ, TRẠNG THÁI, DÙNG TRONG DRAWER)
exports.updateTask = async (req, res) => {
    try {
        const taskId = req.params.id;
        const currentUserId = req.user?.id || req.user?._id;

        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        // KIỂM TRA QUYỀN TRUY CẬP AN TOÀN (BẢO VỆ CHO CẢ BACKLOG TASK):
        let isAuthorized = false;

        // Case 1: Nếu Task đã ở trên Cột (Board)
        if (task.columnId) {
            const column = await Column.findById(task.columnId);
            if (column && column.projectId) {
                const project = await Project.findOne({ _id: column.projectId, userId: currentUserId });
                if (project) isAuthorized = true;
            }
        }
        // Case 2: Nếu Task nằm trong Backlog (Trực thuộc ProjectId)
        else if (task.projectId) {
            const project = await Project.findOne({ _id: task.projectId, userId: currentUserId });
            if (project) isAuthorized = true;
        }
        // Case 3: Cho phép nếu chính người dùng đang thao tác
        else {
            isAuthorized = true;
        }

        if (!isAuthorized) {
            return res.status(403).json({ message: 'Unauthorized to update this task' });
        }

        // Cập nhật Task
        const updatedTask = await Task.findByIdAndUpdate(
            taskId,
            req.body,
            { new: true, runValidators: true }
        );

        // Ghi log chi tiết hoạt động
        if (req.body.assignees) {
            await logActivity(taskId, currentUserId, 'đã cập nhật danh sách người thực hiện');
        } else if (req.body.title && req.body.title !== task.title) {
            await logActivity(taskId, currentUserId, `đã đổi tên task thành "${req.body.title}"`);
        } else if (req.body.columnId && String(req.body.columnId) !== String(task.columnId)) {
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
        console.error("Lỗi khi updateTask:", err);
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

        const task = await Task.findById(taskId);
        if (!task) return res.status(404).json({ message: 'Task không tồn tại' });

        const destCol = await Column.findById(destColumnId);
        if (!destCol) {
            return res.status(400).json({ message: 'Cột đích không tồn tại' });
        }

        // CASE 1: CHUYỂN TỪ BACKLOG (sourceColumnId: null) SANG CỘT TODO TRÊN BOARD
        if (!sourceColumnId) {
            // Cập nhật columnId mới cho Task
            task.columnId = destColumnId;

            // Thêm taskId vào danh sách taskOrderIds của Cột Todo
            const destOrder = destCol.taskOrderIds.map(id => id.toString());
            const validIndex = Math.max(0, Math.min(destinationIndex || 0, destOrder.length));
            destOrder.splice(validIndex, 0, taskId);
            destCol.taskOrderIds = destOrder;

            await Promise.all([
                task.save(),
                destCol.save()
            ]);

            if (currentUserId) {
                await logActivity(taskId, currentUserId, `đã đẩy task từ Backlog sang cột "${destCol.name || 'Todo'}"`);
            }

            return res.status(200).json({ message: 'Đẩy lên Board thành công', task });
        }

        // CASE 2: KÉO THẢ GIỮA CÁC CỘT TRÊN BOARD (GIỮ NGUYÊN CODE CŨ CỦA BẠN)
        const sourceCol = await Column.findById(sourceColumnId);
        if (!sourceCol) {
            return res.status(400).json({ message: 'Cột nguồn không hợp lệ' });
        }

        // (Giữ nguyên logic di chuyển giữa 2 cột cũ của bạn ở đây...)
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

        return res.status(200).json({ message: 'Cập nhật vị trí thành công', taskId });

    } catch (err) {
        console.error('Lỗi khi moveTask:', err);
        return res.status(500).json({ error: err.message });
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

exports.getComments = async (req, res) => {
    res.json([]);
};

// Lấy Activity
exports.getActivities = async (req, res) => {
    res.json([]);
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
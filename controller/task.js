const Task = require('./../model/task');
const Column = require('./../model/column');
const Project = require('./../model/project');
const Comment = require('../model/Comment');
const TaskActivity = require('../model/activity');

// Import hàm cập nhật điểm từ controller user.js
const { updateAssigneesPoints } = require('./user');

// Helper function ghi log hoạt động
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

// Helper trích xuất mảng ID chuẩn cho assignees
const extractAssigneeIds = (assignees) => {
    if (!Array.isArray(assignees)) return [];
    return assignees.map(a => {
        if (typeof a === 'object' && a !== null) {
            return String(a._id || a.id || '');
        }
        return String(a);
    }).filter(id => Boolean(id));
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

        const columns = await Column.find({ projectId }).select('_id title position');
        const columnIds = columns ? columns.map(col => col._id) : [];

        const tasks = await Task.find({
            $or: [
                { columnId: { $in: columnIds } },
                { projectId: projectId, columnId: null },
                { projectId: projectId, columnId: { $exists: false } }
            ]
        })
            .populate('assignees', 'username name email')
            .populate('columnId', 'title position projectId');

        res.status(200).json(tasks);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createTask = async (req, res) => {
    try {
        const { title, description, columnId, projectId, assignees, priority, date, point } = req.body;
        const currentUserId = req.user ? (req.user.id || req.user._id) : null;

        if (!title || !title.trim()) {
            return res.status(400).json({ message: 'Task title is required' });
        }

        if (!projectId) {
            return res.status(400).json({ message: 'Missing projectId' });
        }

        const pointVal = Number(point || 0);

        const taskData = {
            title: title.trim(),
            description: description || '',
            projectId: projectId,
            assignees: Array.isArray(assignees) ? assignees : [],
            priority: priority || 'Medium',
            date: date || new Date(),
            point: pointVal
        };

        if (columnId) {
            const column = await Column.findById(columnId);
            if (!column) {
                return res.status(404).json({ message: 'Selected column does not exist' });
            }
            taskData.columnId = columnId;
        }

        const newTask = new Task(taskData);
        await newTask.save();

        if (columnId) {
            await Column.findByIdAndUpdate(columnId, {
                $push: { taskOrderIds: newTask._id }
            });
        }

        if (typeof logActivity === 'function' && currentUserId) {
            await logActivity(newTask._id, currentUserId, 'đã tạo task này').catch(() => {});
        }

        return res.status(201).json(newTask);

    } catch (err) {
        console.error("❌ Lỗi createTask Backend:", err);
        return res.status(500).json({ error: err.message });
    }
};

exports.updateTask = async (req, res) => {
    try {
        const taskId = req.params.id;
        const currentUserId = req.user?.id || req.user?._id;

        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        if (req.body.point !== undefined) {
            req.body.point = Number(req.body.point || 0);
        }

        const updatedTask = await Task.findByIdAndUpdate(
            taskId,
            req.body,
            { new: true, runValidators: true }
        );

        if (req.body.assignees) {
            await logActivity(taskId, currentUserId, 'đã cập nhật danh sách người thực hiện');
        } else if (req.body.title && req.body.title !== task.title) {
            await logActivity(taskId, currentUserId, `đã đổi tên task thành "${req.body.title}"`);
        } else if (req.body.columnId && String(req.body.columnId) !== String(task.columnId)) {
            const targetCol = await Column.findById(req.body.columnId);
            const colName = targetCol ? (targetCol.title || targetCol.name) : 'mới';
            await logActivity(taskId, currentUserId, `đã chuyển task sang cột "${colName}"`);
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

        let projectId = task.projectId;
        let column = null;

        if (task.columnId) {
            column = await Column.findById(task.columnId);
            if (column && !projectId) {
                projectId = column.projectId;
            }
        }

        if (projectId) {
            const project = await Project.findById(projectId);
            if (!project) {
                return res.status(404).json({ message: 'Project not found' });
            }

        }

        await Promise.all([
            TaskActivity.deleteMany({ taskId }),
            Comment.deleteMany({ taskId })
        ]);

        await Task.findByIdAndDelete(taskId);

        if (column && Array.isArray(column.taskOrderIds)) {
            column.taskOrderIds = column.taskOrderIds.filter(id => id.toString() !== taskId.toString());
            await column.save();
        }

        return res.json({ message: 'Task deleted successfully', id: taskId });
    } catch (err) {
        console.error('Delete Task Error:', err);
        return res.status(500).json({ error: err.message });
    }
};

// DI CHUYỂN TASK (KÉO THẢ & CỘNG / TRỪ ĐIỂM)
exports.moveTask = async (req, res) => {
    try {
        const taskId = req.params.id;
        let { sourceColumnId, destColumnId, destinationIndex } = req.body;
        const currentUserId = req.user?.id || req.user?._id;

        if (sourceColumnId === 'null' || sourceColumnId === 'undefined' || !sourceColumnId) {
            sourceColumnId = null;
        }
        if (!destColumnId || destColumnId === 'null' || destColumnId === 'undefined') {
            return res.status(400).json({ message: 'Cột đích không hợp lệ' });
        }

        const task = await Task.findById(taskId);
        if (!task) return res.status(404).json({ message: 'Task không tồn tại' });

        const destCol = await Column.findById(destColumnId);
        if (!destCol) return res.status(400).json({ message: 'Cột đích không tồn tại' });

        const sourceCol = sourceColumnId ? await Column.findById(sourceColumnId) : null;

        // ƯU TIÊN LẤY Column.title (dựa theo Schema) NẾU KHÔNG CÓ MỚI LẤY Column.name
        const destTitle = (destCol.title || destCol.name || '').toLowerCase();
        const sourceTitle = sourceCol ? (sourceCol.title || sourceCol.name || '').toLowerCase() : '';

        // ĐIỀU KIỆN NHẬN DIỆN CỘT HOÀN THÀNH
        const isDestDone = destTitle.includes('done') || destTitle.includes('Done') || destTitle.includes('accepted') || destTitle.includes('finish');
        const isSourceDone = sourceTitle.includes('done') || sourceTitle.includes('Done') || sourceTitle.includes('accepted') || sourceTitle.includes('finish');

        const taskPoints = Number(task.point || 0);
        const assigneeIds = extractAssigneeIds(task.assignees);

        // Kéo vào cột Done từ cột khác -> Cộng điểm
        if (isDestDone && !isSourceDone && taskPoints > 0 && assigneeIds.length > 0) {
            if (typeof updateAssigneesPoints === 'function') {
                console.log(`Cộng điểm cho assignees ${assigneeIds.join(', ')} với số điểm ${taskPoints}`);
                await updateAssigneesPoints(assigneeIds, taskPoints);
            }
        }
        // Kéo từ cột Done ra cột khác -> Trừ lại điểm
        else if (!isDestDone && isSourceDone && taskPoints > 0 && assigneeIds.length > 0) {
            if (typeof updateAssigneesPoints === 'function') {
                await updateAssigneesPoints(assigneeIds, -taskPoints);
            }
        }

        // Cập nhật mảng taskOrderIds của Cột
        if (sourceCol) {
            sourceCol.taskOrderIds = sourceCol.taskOrderIds.filter(id => id.toString() !== taskId.toString());
            await sourceCol.save();
        }

        const destOrder = destCol.taskOrderIds.map(id => id.toString()).filter(id => id !== taskId.toString());
        const validIndex = Math.max(0, Math.min(destinationIndex || 0, destOrder.length));
        destOrder.splice(validIndex, 0, taskId);
        destCol.taskOrderIds = destOrder;

        task.columnId = destColumnId;
        await Promise.all([destCol.save(), task.save()]);

        if (currentUserId) {
            await logActivity(taskId, currentUserId, `đã di chuyển task sang cột "${destCol.title || destCol.name}"`);
        }

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

        const task = await Task.findById(id);
        if (!task) {
            return res.status(404).json({ message: 'Task không tồn tại' });
        }

        task.checklist.push({
            text: text.trim(),
            completed: false,
            taskId: id
        });

        await task.save();

        try {
            await logActivity(id, currentUserId, `đã thêm mục checklist "${text.trim()}"`);
        } catch (logErr) {
            console.error('Lỗi logActivity:', logErr.message);
        }

        return res.status(200).json(task);
    } catch (err) {
        console.error('Lỗi addChecklistItem:', err);
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

exports.deleteChecklist = async (req, res) => {
    try {
        const { id } = req.params;

        const updatedTask = await Task.findOneAndUpdate(
            { "checklist._id": id },
            { $pull: { checklist: { _id: id } } },
            { new: true }
        );

        if (!updatedTask) {
            return res.status(404).json({ message: 'Checklist item không tồn tại' });
        }

        return res.status(200).json({
            message: 'Xóa checklist thành công',
            data: updatedTask
        });
    } catch (err) {
        console.error('Delete Checklist Error:', err);
        return res.status(500).json({ error: err.message });
    }
};

// REVIEW TASK CHO LEADER / MANAGER
exports.reviewTask = async (req, res) => {
    try {
        const { id } = req.params;
        const { action } = req.body; // 'accept' hoặc 'not_accept'
        const currentUserId = req.user?.id || req.user?._id;

        const task = await Task.findById(id);
        if (!task) return res.status(404).json({ message: 'Task không tồn tại' });

        const columns = await Column.find({ projectId: task.projectId });
        const taskPoints = Number(task.point || 0);
        const assigneeIds = extractAssigneeIds(task.assignees);

        if (action === 'not_accept') {
            const reviewColumn = columns.find(c => {
                const title = (c.title || c.name || '').toLowerCase();
                return title.includes('in review') || title.includes('review');
            });

            if (reviewColumn) {
                task.columnId = reviewColumn._id;
                await task.save();

                if (taskPoints > 0 && assigneeIds.length > 0 && typeof updateAssigneesPoints === 'function') {
                    await updateAssigneesPoints(assigneeIds, -taskPoints);
                }

                await logActivity(id, currentUserId, 'không duyệt task, đã trừ điểm và chuyển về Review');
            }
        } else if (action === 'accept') {
            const doneColumn = columns.find(c => {
                const title = (c.title || c.name || '').toLowerCase();
                return title.includes('done') || title.includes('Done') || title.includes('accepted');
            });

            if (doneColumn) {
                task.columnId = doneColumn._id;
                await task.save();

                if (taskPoints > 0 && assigneeIds.length > 0 && typeof updateAssigneesPoints === 'function') {
                    await updateAssigneesPoints(assigneeIds, taskPoints);
                }

                await logActivity(id, currentUserId, 'đã duyệt task (Accepted)');
            }
        }

        return res.status(200).json({ message: 'Cập nhật trạng thái thành công', task });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
const Task = require('./../model/task');
const Column = require('./../model/column');
const Project = require('./../model/project');

exports.getTask = async (req, res) => {
    try {
        const { columnId } = req.query;
        let filter = {};
        if (columnId) {
            filter.columnId = columnId;
        }
        const tasks = await Task.find(filter).sort('position');
        res.json(tasks);
    }
    catch (err) {
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
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// 🟢 LẤY TẤT CẢ TASK CỦA 1 PROJECT DỰA VÀO COLUMN
exports.getTasksByProject = async (req, res) => {
    try {
        // Hỗ trợ lấy projectId từ req.query hoặc req.params
        const projectId = req.query.projectId || req.params.projectId || req.params.id;

        if (!projectId) {
            return res.status(400).json({ message: 'Thiếu projectId' });
        }

        // BƯỚC 1: Tìm tất cả Column thuộc Project này
        const columns = await Column.find({ projectId }).select('_id name position');

        if (!columns || columns.length === 0) {
            return res.status(200).json([]); // Project chưa có cột nào -> Trả về mảng rỗng
        }

        // Lấy danh sách ID các cột thuộc project
        const columnIds = columns.map(col => col._id);

        // BƯỚC 2: Tìm tất cả Task nằm trong các Cột đó
        const tasks = await Task.find({ columnId: { $in: columnIds } })
            .populate('assignees', 'username email')
            .populate('columnId', 'name position projectId'); // Populate thông tin cột để frontend dễ đếm

        res.status(200).json(tasks);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 🟢 TẠO TASK MỚI
exports.createTask = async (req, res) => {
    try {
        const { title, description, columnId, projectId, assignees, priority, date } = req.body;
        const currentUserId = req.user.id;

        if (!title || !title.trim()) {
            return res.status(400).json({ message: 'Task title is required' });
        }

        let targetColumnId = columnId;

        // Nếu Frontend chỉ gửi projectId mà không gửi columnId, tự tìm cột đầu tiên (VD: cột To do)
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

        // Cập nhật danh sách ID task trong Column
        column.taskOrderIds.push(newTask._id);
        await column.save();

        res.status(201).json({
            message: 'Task created successfully',
            task: newTask
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.updateTask = async (req, res) => {
    try {
        const taskId = req.params.id;
        const currentUserId = req.user.id;

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

        res.json(updatedTask);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.deleteTask = async (req, res) => {
    try {
        const taskId = req.params.id;
        const currentUserId = req.user.id;

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

        // Xóa ID task khỏi Column
        if (column) {
            column.taskOrderIds = column.taskOrderIds.filter(id => id.toString() !== taskId);
            await column.save();
        }

        res.json({ message: 'Task deleted successfully', id: taskId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.moveTask = async (req, res) => {
    try {
        const taskId = req.params.id;
        const { sourceColumnId, destColumnId, destinationIndex } = req.body;
        const currentUserId = req.user.id; // Lấy ID của user đang đăng nhập

        const task = await Task.findById(taskId);
        if (!task) return res.status(404).json({ message: 'Task không tồn tại' });

        const isAssignee = task.assignees.some(assigneeId => assigneeId.toString() === currentUserId);
        if (!isAssignee) {
            return res.status(403).json({ message: 'Chỉ người được phân công (assignee) mới có quyền di chuyển task này' });
        }

        const sourceCol = await Column.findById(sourceColumnId);
        const destCol = await Column.findById(destColumnId);

        if (!sourceCol || !destCol) {
            return res.status(400).json({ message: 'Cột nguồn hoặc cột đích không hợp lệ' });
        }

        const project = await Project.findOne({ _id: sourceCol.projectId });
        if (!project) {
            return res.status(403).json({ message: 'Bạn không có quyền thực hiện thao tác này' });
        }

        // Kéo thả TRONG CÙNG 1 CỘT
        if (sourceColumnId === destColumnId) {
            const currentOrder = sourceCol.taskOrderIds.map(id => id.toString());
            const filteredOrder = currentOrder.filter(id => id !== taskId.toString());
            filteredOrder.splice(destinationIndex, 0, taskId);

            sourceCol.taskOrderIds = filteredOrder;
            await sourceCol.save();
        }
        // Kéo thả SANG CỘT KHÁC
        else {
            sourceCol.taskOrderIds = sourceCol.taskOrderIds.filter(id => id.toString() !== taskId.toString());
            await sourceCol.save();

            const destOrder = destCol.taskOrderIds.map(id => id.toString());
            destOrder.splice(destinationIndex, 0, taskId);

            destCol.taskOrderIds = destOrder;
            await destCol.save();

            task.columnId = destColumnId;
            await task.save();
        }

        return res.status(200).json({
            message: 'Cập nhật vị trí thành công',
            taskId,
            destColumnId,
            taskOrderIds: sourceColumnId === destColumnId ? sourceCol.taskOrderIds : destCol.taskOrderIds
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
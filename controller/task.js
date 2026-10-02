const Task = require('./../model/task');
const Column = require('./../model/column');
const Project = require('./../model/project');
const Comment = require('../model/Comment');
const TaskActivity = require('../model/activity');

// Import helper updating user points
const { updateAssigneesPoints } = require('./user');

// Helper function to log activity
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
        console.error('Error logging TaskActivity:', err.message);
    }
};

// Helper function to extract array of string IDs for assignees
const extractAssigneeIds = (assignees) => {
    if (!Array.isArray(assignees)) return [];
    return assignees.map(a => {
        if (typeof a === 'object' && a !== null) {
            return String(a._id || a.id || '');
        }
        return String(a);
    }).filter(id => Boolean(id));
};

// Get tasks with optional columnId filtering
exports.getTask = async (req, res) => {
    try {
        const { columnId } = req.query;
        let filter = {};
        if (columnId) {
            filter.columnId = columnId;
        }
        const tasks = await Task.find(filter)
            .populate('assignees', 'username name email')
            .populate('columnId', 'title position projectId');
        res.json(tasks);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get task by ID
exports.getTaskById = async (req, res) => {
    try {
        const task = await Task.findById(req.params.id)
            .populate('assignees', 'username name email')
            .populate('columnId', 'title position projectId');
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }
        res.json(task);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get tasks by project ID
exports.getTasksByProject = async (req, res) => {
    try {
        const projectId = req.query.projectId || req.params.projectId || req.params.id;

        if (!projectId) {
            return res.status(400).json({ message: 'Missing projectId' });
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

// Create new task
exports.createTask = async (req, res) => {
    try {
        const { title, description, columnId, projectId, assignees, priority, point, week, status } = req.body;
        const currentUserId = req.user ? (req.user.id || req.user._id) : null;

        if (!title || !title.trim()) {
            return res.status(400).json({ message: 'Task title is required' });
        }

        if (!projectId) {
            return res.status(400).json({ message: 'Missing projectId' });
        }

        const pointVal = Number(point || 0);
        const weekVal = Number(week || 1);

        const taskData = {
            title: title.trim(),
            description: description || '',
            projectId: projectId,
            assignees: Array.isArray(assignees) ? assignees : [],
            priority: priority || 'Medium',
            point: pointVal,
            week: weekVal,
            status: status || 'pending'
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
            await logActivity(newTask._id, currentUserId, 'created this task').catch(() => {});
        }

        return res.status(201).json(newTask);

    } catch (err) {
        console.error("❌ Error createTask Backend:", err);
        return res.status(500).json({ error: err.message });
    }
};

// Update task
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
        if (req.body.week !== undefined) {
            req.body.week = Number(req.body.week || 1);
        }

        const updatedTask = await Task.findByIdAndUpdate(
            taskId,
            req.body,
            { new: true, runValidators: true }
        ).populate('assignees', 'username name email');

        if (req.body.assignees) {
            await logActivity(taskId, currentUserId, 'updated assignees list');
        } else if (req.body.title && req.body.title !== task.title) {
            await logActivity(taskId, currentUserId, `changed title to "${req.body.title}"`);
        } else if (req.body.columnId && String(req.body.columnId) !== String(task.columnId)) {
            const targetCol = await Column.findById(req.body.columnId);
            const colName = targetCol ? (targetCol.title || targetCol.name) : 'new column';
            await logActivity(taskId, currentUserId, `moved task to column "${colName}"`);
        } else if (req.body.priority && req.body.priority !== task.priority) {
            await logActivity(taskId, currentUserId, `changed priority to ${req.body.priority}`);
        } else if (req.body.status && req.body.status !== task.status) {
            await logActivity(taskId, currentUserId, `changed status to ${req.body.status}`);
        } else if (req.body.description !== undefined && req.body.description !== task.description) {
            await logActivity(taskId, currentUserId, 'updated task description');
        } else {
            await logActivity(taskId, currentUserId, 'updated task details');
        }

        res.json(updatedTask);
    } catch (err) {
        console.error("Error updating task:", err);
        res.status(500).json({ error: err.message });
    }
};

// Delete task
exports.deleteTask = async (req, res) => {
    try {
        const taskId = req.params.id;

        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        let column = null;
        if (task.columnId) {
            column = await Column.findById(task.columnId);
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

// Move task between columns & adjust user points
exports.moveTask = async (req, res) => {
    try {
        const taskId = req.params.id;
        let { sourceColumnId, destColumnId, destinationIndex } = req.body;
        const currentUserId = req.user?.id || req.user?._id;

        if (sourceColumnId === 'null' || sourceColumnId === 'undefined' || !sourceColumnId) {
            sourceColumnId = null;
        }
        if (!destColumnId || destColumnId === 'null' || destColumnId === 'undefined') {
            return res.status(400).json({ message: 'Invalid destination column' });
        }

        const task = await Task.findById(taskId);
        if (!task) return res.status(404).json({ message: 'Task not found' });

        const destCol = await Column.findById(destColumnId);
        if (!destCol) return res.status(400).json({ message: 'Destination column not found' });

        const sourceCol = sourceColumnId ? await Column.findById(sourceColumnId) : null;

        const destTitle = (destCol.title || destCol.name || '').toLowerCase();
        const sourceTitle = sourceCol ? (sourceCol.title || sourceCol.name || '').toLowerCase() : '';

        const isDestDone = destTitle.includes('done') || destTitle.includes('accepted') || destTitle.includes('finish');
        const isSourceDone = sourceTitle.includes('done') || sourceTitle.includes('accepted') || sourceTitle.includes('finish');

        const taskPoints = Number(task.point || 0);
        const assigneeIds = extractAssigneeIds(task.assignees);

        // Add points when moved to Done column
        if (isDestDone && !isSourceDone && taskPoints > 0 && assigneeIds.length > 0) {
            if (typeof updateAssigneesPoints === 'function') {
                await updateAssigneesPoints(assigneeIds, taskPoints);
            }
        }
        // Deduct points when moved out of Done column
        else if (!isDestDone && isSourceDone && taskPoints > 0 && assigneeIds.length > 0) {
            if (typeof updateAssigneesPoints === 'function') {
                await updateAssigneesPoints(assigneeIds, -taskPoints);
            }
        }

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
            await logActivity(taskId, currentUserId, `moved task to column "${destCol.title || destCol.name}"`);
        }

        return res.status(200).json({ message: 'Task position updated successfully', taskId });
    } catch (err) {
        console.error('Error moving task:', err);
        return res.status(500).json({ error: err.message });
    }
};

// Checklist management
exports.toggleChecklistItem = async (req, res) => {
    try {
        const { id, itemId } = req.params;
        const currentUserId = req.user?.id || req.user?._id;

        const task = await Task.findById(id);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        const item = task.checklist.find((chk, idx) =>
            String(chk._id) === String(itemId) || String(idx) === String(itemId)
        );

        if (!item) {
            return res.status(404).json({ message: 'Checklist item not found' });
        }

        const newStatus = !item.completed;

        const updatedTask = await Task.findOneAndUpdate(
            { _id: id, "checklist._id": item._id },
            { $set: { "checklist.$.completed": newStatus } },
            { new: true }
        );

        const actionMsg = newStatus
            ? `completed item "${item.text}"`
            : `marked item "${item.text}" as uncompleted`;
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
            return res.status(400).json({ message: 'Checklist item text is required' });
        }

        const task = await Task.findById(id);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        task.checklist.push({
            text: text.trim(),
            completed: false,
            taskId: id
        });

        await task.save();

        try {
            await logActivity(id, currentUserId, `added checklist item "${text.trim()}"`);
        } catch (logErr) {
            console.error('LogActivity error:', logErr.message);
        }

        return res.status(200).json(task);
    } catch (err) {
        console.error('AddChecklistItem error:', err);
        return res.status(500).json({ error: err.message });
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
            return res.status(404).json({ message: 'Checklist item not found' });
        }

        return res.status(200).json({
            message: 'Checklist item deleted successfully',
            data: updatedTask
        });
    } catch (err) {
        console.error('Delete Checklist Error:', err);
        return res.status(500).json({ error: err.message });
    }
};

// Comments management
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
            return res.status(400).json({ message: 'Comment content is required' });
        }

        const newComment = new Comment({
            taskId: id,
            user: userId,
            text: text.trim()
        });

        await newComment.save();
        await newComment.populate('user', 'username email name');

        await logActivity(id, userId, 'added a comment');

        return res.status(201).json(newComment);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// Activity history
exports.getTaskActivities = async (req, res) => {
    try {
        const taskId = req.params.taskId || req.params.id;

        const activities = await TaskActivity.find({ taskId })
            .populate('user', 'username name email avatar')
            .sort({ createdAt: -1 });

        return res.status(200).json(activities);
    } catch (error) {
        return res.status(500).json({
            message: 'Failed to fetch task activities',
            error: error.message
        });
    }
};

// Review task action (Accept / Not Accept)
exports.reviewTask = async (req, res) => {
    try {
        const { id } = req.params;
        const { action } = req.body; // 'accept' or 'not_accept'
        const currentUserId = req.user?.id || req.user?._id;

        const task = await Task.findById(id);
        if (!task) return res.status(404).json({ message: 'Task not found' });

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
                task.status = 'pending';
                await task.save();

                if (taskPoints > 0 && assigneeIds.length > 0 && typeof updateAssigneesPoints === 'function') {
                    await updateAssigneesPoints(assigneeIds, -taskPoints);
                }

                await logActivity(id, currentUserId, 'rejected task, deducted points and moved back to Review');
            }
        } else if (action === 'accept') {
            const doneColumn = columns.find(c => {
                const title = (c.title || c.name || '').toLowerCase();
                return title.includes('done') || title.includes('accepted');
            });

            if (doneColumn) {
                task.columnId = doneColumn._id;
                task.status = 'completed';
                await task.save();

                if (taskPoints > 0 && assigneeIds.length > 0 && typeof updateAssigneesPoints === 'function') {
                    await updateAssigneesPoints(assigneeIds, taskPoints);
                }

                await logActivity(id, currentUserId, 'accepted task');
            }
        }

        return res.status(200).json({ message: 'Status updated successfully', task });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};



exports.getMyTasks = async (req, res) => {
    try {
        const currentUserId = req.user.id; 

        const myTasks = await Task.find({ assignees: currentUserId })
            .populate({
                path: 'projectId',
                select: 'name color description' 
            })
            .populate({
                path: 'columnId',
                select: 'title position' 
            })
            .sort({ updatedAt: -1 }); 
        return res.status(200).json(myTasks);
        
    } catch (error) {
        console.error("Lỗi tại getMyTasks Controller:", error);
        return res.status(500).json({ 
            message: 'Đã xảy ra lỗi hệ thống khi lấy danh sách công việc!', 
            error: error.message 
        });
    }
}
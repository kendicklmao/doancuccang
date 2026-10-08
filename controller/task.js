// const Task = require('./../model/task');
// const Column = require('./../model/column');
// const Project = require('./../model/project');
// const Comment = require('../model/Comment');
// const TaskActivity = require('../model/activity');
// const mongoose = require('mongoose');
// const { getIO } = require('../socket'); // Import hàm lấy phiên bản socket.io

// // Import helper updating user points
// const { updateAssigneesPoints } = require('./user');

// // Helper function to log activity
// const logActivity = async (taskId, userId, action, details = null) => {
//     try {
//         if (!taskId || !userId) return;
//         await TaskActivity.create({
//             taskId,
//             user: userId,
//             action,
//             details
//         });
//     } catch (err) {
//         console.error('Error logging TaskActivity:', err.message);
//     }
// };

// // Helper function to extract array of string IDs for assignees
// const extractAssigneeIds = (assignees) => {
//     if (!Array.isArray(assignees)) return [];
//     return assignees.map(a => {
//         if (typeof a === 'object' && a !== null) {
//             return String(a._id || a.id || '');
//         }
//         return String(a);
//     }).filter(id => Boolean(id));
// };

// // Get tasks with optional columnId filtering
// exports.getTask = async (req, res) => {
//     try {
//         const { columnId } = req.query;
//         let filter = {};
//         if (columnId) {
//             filter.columnId = columnId;
//         }
//         const tasks = await Task.find(filter)
//             .populate('assignees', 'username name email')
//             .populate('columnId', 'title position projectId');
//         res.json(tasks);
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// };

// // Get task by ID
// exports.getTaskById = async (req, res) => {
//     try {
//         const task = await Task.findById(req.params.id)
//             .populate('assignees', 'username name email')
//             .populate('columnId', 'title position projectId');
//         if (!task) {
//             return res.status(404).json({ message: 'Task not found' });
//         }
//         res.json(task);
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// };

// // Get tasks by project ID
// exports.getTasksByProject = async (req, res) => {
//     try {
//         const projectId = req.query.projectId || req.params.projectId || req.params.id;

//         if (!projectId) {
//             return res.status(400).json({ message: 'Missing projectId' });
//         }

//         const columns = await Column.find({ projectId }).select('_id title position');
//         const columnIds = columns ? columns.map(col => col._id) : [];

//         const tasks = await Task.find({
//             $or: [
//                 { columnId: { $in: columnIds } },
//                 { projectId: projectId, columnId: null },
//                 { projectId: projectId, columnId: { $exists: false } }
//             ]
//         })
//             .populate('assignees', 'username name email')
//             .populate('columnId', 'title position projectId');

//         res.status(200).json(tasks);
//     } catch (error) {
//         res.status(500).json({ message: error.message });
//     }
// };

// // Create new task
// exports.createTask = async (req, res) => {
//     try {
//         const { title, description, columnId, projectId, assignees, priority, point, week, status } = req.body;
//         const currentUserId = req.user ? (req.user.id || req.user._id) : null;

//         if (!title || !title.trim()) {
//             return res.status(400).json({ message: 'Task title is required' });
//         }

//         if (!projectId) {
//             return res.status(400).json({ message: 'Missing projectId' });
//         }

//         const pointVal = Number(point || 0);
//         const weekVal = Number(week || 1);

//         const taskData = {
//             title: title.trim(),
//             description: description || '',
//             projectId: projectId,
//             assignees: Array.isArray(assignees) ? assignees : [],
//             priority: priority || 'Medium',
//             point: pointVal,
//             week: weekVal,
//             status: status || 'pending'
//         };

//         if (columnId) {
//             const column = await Column.findById(columnId);
//             if (!column) {
//                 return res.status(404).json({ message: 'Selected column does not exist' });
//             }
//             taskData.columnId = columnId;
//         }

//         const newTask = new Task(taskData);
//         await newTask.save();

//         if (columnId) {
//             await Column.findByIdAndUpdate(columnId, {
//                 $push: { taskOrderIds: newTask._id }
//             });
//         }

//         if (typeof logActivity === 'function' && currentUserId) {
//             await logActivity(newTask._id, currentUserId, 'created this task').catch(() => {});
//         }

//         // 🟢 SOCKET: Phát sự kiện tạo task mới cho tất cả client trong dự án
//         try {
//             getIO().to(`project_${projectId}`).emit("task_created", newTask);
//         } catch (socketErr) {
//             console.error("Socket emit error (createTask):", socketErr.message);
//         }

//         return res.status(201).json(newTask);

//     } catch (err) {
//         console.error("❌ Error createTask Backend:", err);
//         return res.status(500).json({ error: err.message });
//     }
// };

// // Update task
// exports.updateTask = async (req, res) => {
//     try {
//         const taskId = req.params.id;
//         const currentUserId = req.user?.id || req.user?._id;

//         const task = await Task.findById(taskId);
//         if (!task) {
//             return res.status(404).json({ message: 'Task not found' });
//         }

//         if (req.body.point !== undefined) {
//             req.body.point = Number(req.body.point || 0);
//         }
//         if (req.body.week !== undefined) {
//             req.body.week = Number(req.body.week || 1);
//         }

//         const updatedTask = await Task.findByIdAndUpdate(
//             taskId,
//             req.body,
//             { new: true, runValidators: true }
//         ).populate('assignees', 'username name email');

//         if (req.body.assignees) {
//             await logActivity(taskId, currentUserId, 'updated assignees list');
//         } else if (req.body.title && req.body.title !== task.title) {
//             await logActivity(taskId, currentUserId, `changed title to "${req.body.title}"`);
//         } else if (req.body.columnId && String(req.body.columnId) !== String(task.columnId)) {
//             const targetCol = await Column.findById(req.body.columnId);
//             const colName = targetCol ? (targetCol.title || targetCol.name) : 'new column';
//             await logActivity(taskId, currentUserId, `moved task to column "${colName}"`);
//         } else if (req.body.priority && req.body.priority !== task.priority) {
//             await logActivity(taskId, currentUserId, `changed priority to ${req.body.priority}`);
//         } else if (req.body.status && req.body.status !== task.status) {
//             await logActivity(taskId, currentUserId, `changed status to ${req.body.status}`);
//         } else if (req.body.description !== undefined && req.body.description !== task.description) {
//             await logActivity(taskId, currentUserId, 'updated task description');
//         } else {
//             await logActivity(taskId, currentUserId, 'updated task details');
//         }

//         // 🟢 SOCKET: Bắn sự kiện task_updated cho cả project
//         try {
//             getIO().to(`project_${task.projectId}`).emit("task_updated", updatedTask);
//         } catch (socketErr) {
//             console.error("Socket emit error (updateTask):", socketErr.message);
//         }

//         res.json(updatedTask);
//     } catch (err) {
//         console.error("Error updating task:", err);
//         res.status(500).json({ error: err.message });
//     }
// };

// // Delete task
// exports.deleteTask = async (req, res) => {
//     try {
//         const taskId = req.params.id;

//         const task = await Task.findById(taskId);
//         if (!task) {
//             return res.status(404).json({ message: 'Task not found' });
//         }

//         let column = null;
//         if (task.columnId) {
//             column = await Column.findById(task.columnId);
//         }

//         await Promise.all([
//             TaskActivity.deleteMany({ taskId }),
//             Comment.deleteMany({ taskId })
//         ]);

//         await Task.findByIdAndDelete(taskId);

//         if (column && Array.isArray(column.taskOrderIds)) {
//             column.taskOrderIds = column.taskOrderIds.filter(id => id.toString() !== taskId.toString());
//             await column.save();
//         }

//         // 🟢 SOCKET: Bắn sự kiện task_deleted cho cả project
//         try {
//             getIO().to(`project_${task.projectId}`).emit("task_deleted", { taskId });
//         } catch (socketErr) {
//             console.error("Socket emit error (deleteTask):", socketErr.message);
//         }

//         return res.json({ message: 'Task deleted successfully', id: taskId });
//     } catch (err) {
//         console.error('Delete Task Error:', err);
//         return res.status(500).json({ error: err.message });
//     }
// };

// // Move task between columns & adjust user points
// exports.moveTask = async (req, res) => {
//     try {
//         const taskId = req.params.id;
//         let { sourceColumnId, destColumnId, destinationIndex } = req.body;
//         const currentUserId = req.user?.id || req.user?._id;

//         if (sourceColumnId === 'null' || sourceColumnId === 'undefined' || !sourceColumnId) {
//             sourceColumnId = null;
//         }
//         if (!destColumnId || destColumnId === 'null' || destColumnId === 'undefined') {
//             return res.status(400).json({ message: 'Invalid destination column' });
//         }

//         const task = await Task.findById(taskId);
//         if (!task) return res.status(404).json({ message: 'Task not found' });

//         const destCol = await Column.findById(destColumnId);
//         if (!destCol) return res.status(400).json({ message: 'Destination column not found' });

//         const sourceCol = sourceColumnId ? await Column.findById(sourceColumnId) : null;

//         const destTitle = (destCol.title || destCol.name || '').toLowerCase();
//         const sourceTitle = sourceCol ? (sourceCol.title || sourceCol.name || '').toLowerCase() : '';

//         const isDestDone = destTitle.includes('done') || destTitle.includes('accepted') || destTitle.includes('finish');
//         const isSourceDone = sourceTitle.includes('done') || sourceTitle.includes('accepted') || sourceTitle.includes('finish');

//         const taskPoints = Number(task.point || 0);
//         const assigneeIds = extractAssigneeIds(task.assignees);

//         // Add points when moved to Done column
//         if (isDestDone && !isSourceDone && taskPoints > 0 && assigneeIds.length > 0) {
//             if (typeof updateAssigneesPoints === 'function') {
//                 await updateAssigneesPoints(assigneeIds, taskPoints);
//             }
//         }
//         // Deduct points when moved out of Done column
//         else if (!isDestDone && isSourceDone && taskPoints > 0 && assigneeIds.length > 0) {
//             if (typeof updateAssigneesPoints === 'function') {
//                 await updateAssigneesPoints(assigneeIds, -taskPoints);
//             }
//         }

//         if (sourceCol) {
//             sourceCol.taskOrderIds = sourceCol.taskOrderIds.filter(id => id.toString() !== taskId.toString());
//             await sourceCol.save();
//         }

//         const destOrder = destCol.taskOrderIds.map(id => id.toString()).filter(id => id !== taskId.toString());
//         const validIndex = Math.max(0, Math.min(destinationIndex || 0, destOrder.length));
//         destOrder.splice(validIndex, 0, taskId);
//         destCol.taskOrderIds = destOrder;

//         // Cập nhật columnId và reset mốc updatedAt về thời điểm chuyển cột mới
//         task.columnId = destColumnId;
//         task.updatedAt = new Date();

//         await Promise.all([destCol.save(), task.save()]);

//         if (currentUserId) {
//             await logActivity(taskId, currentUserId, `moved task to column "${destCol.title || destCol.name}"`);
//         }

//         // 🟢 SOCKET: Bắn sự kiện task_moved tới phòng của Project này
//         try {
//             getIO().to(`project_${task.projectId}`).emit("task_moved", {
//                 taskId,
//                 sourceColumnId,
//                 destColumnId,
//                 destinationIndex
//             });
//         } catch (socketErr) {
//             console.error("Socket emit error (moveTask):", socketErr.message);
//         }

//         return res.status(200).json({ message: 'Task position updated successfully', taskId });
//     } catch (err) {
//         console.error('Error moving task:', err);
//         return res.status(500).json({ error: err.message });
//     }
// };

// // Checklist management
// exports.toggleChecklistItem = async (req, res) => {
//     try {
//         const { id, itemId } = req.params;
//         const currentUserId = req.user?.id || req.user?._id;

//         const task = await Task.findById(id);
//         if (!task) {
//             return res.status(404).json({ message: 'Task not found' });
//         }

//         const item = task.checklist.find((chk, idx) =>
//             String(chk._id) === String(itemId) || String(idx) === String(itemId)
//         );

//         if (!item) {
//             return res.status(404).json({ message: 'Checklist item not found' });
//         }

//         const newStatus = !item.completed;

//         const updatedTask = await Task.findOneAndUpdate(
//             { _id: id, "checklist._id": item._id },
//             { $set: { "checklist.$.completed": newStatus } },
//             { new: true }
//         );

//         const actionMsg = newStatus
//             ? `completed item "${item.text}"`
//             : `marked item "${item.text}" as uncompleted`;
//         await logActivity(id, currentUserId, actionMsg);

//         // 🟢 SOCKET
//         try {
//             getIO().to(`project_${task.projectId}`).emit("task_updated", updatedTask);
//         } catch (socketErr) {
//             console.error("Socket emit error:", socketErr.message);
//         }

//         return res.status(200).json(updatedTask);
//     } catch (err) {
//         return res.status(500).json({ error: err.message });
//     }
// };

// exports.addChecklistItem = async (req, res) => {
//     try {
//         const { id } = req.params;
//         const { text } = req.body;
//         const currentUserId = req.user?.id || req.user?._id;

//         if (!text || !text.trim()) {
//             return res.status(400).json({ message: 'Checklist item text is required' });
//         }

//         const task = await Task.findById(id);
//         if (!task) {
//             return res.status(404).json({ message: 'Task not found' });
//         }

//         task.checklist.push({
//             text: text.trim(),
//             completed: false,
//             taskId: id
//         });

//         await task.save();

//         try {
//             await logActivity(id, currentUserId, `added checklist item "${text.trim()}"`);
//         } catch (logErr) {
//             console.error('LogActivity error:', logErr.message);
//         }

//         // 🟢 SOCKET
//         try {
//             getIO().to(`project_${task.projectId}`).emit("task_updated", task);
//         } catch (socketErr) {
//             console.error("Socket emit error:", socketErr.message);
//         }

//         return res.status(200).json(task);
//     } catch (err) {
//         console.error('AddChecklistItem error:', err);
//         return res.status(500).json({ error: err.message });
//     }
// };

// exports.deleteChecklist = async (req, res) => {
//     try {
//         const { id } = req.params;

//         const updatedTask = await Task.findOneAndUpdate(
//             { "checklist._id": id },
//             { $pull: { checklist: { _id: id } } },
//             { new: true }
//         );

//         if (!updatedTask) {
//             return res.status(404).json({ message: 'Checklist item not found' });
//         }

//         // 🟢 SOCKET
//         try {
//             getIO().to(`project_${updatedTask.projectId}`).emit("task_updated", updatedTask);
//         } catch (socketErr) {
//             console.error("Socket emit error:", socketErr.message);
//         }

//         return res.status(200).json({
//             message: 'Checklist item deleted successfully',
//             data: updatedTask
//         });
//     } catch (err) {
//         console.error('Delete Checklist Error:', err);
//         return res.status(500).json({ error: err.message });
//     }
// };

// // Comments management
// exports.getTaskComments = async (req, res) => {
//     try {
//         const { id } = req.params;
//         const comments = await Comment.find({ taskId: id })
//             .populate('user', 'username email name')
//             .sort({ createdAt: 1 });

//         return res.status(200).json(comments);
//     } catch (err) {
//         return res.status(500).json({ error: err.message });
//     }
// };

// exports.addComment = async (req, res) => {
//     try {
//         const { id } = req.params;
//         const { text } = req.body;
//         const userId = req.user.id || req.user._id;

//         if (!text || !text.trim()) {
//             return res.status(400).json({ message: 'Comment content is required' });
//         }

//         const task = await Task.findById(id);

//         const newComment = new Comment({
//             taskId: id,
//             user: userId,
//             text: text.trim()
//         });

//         await newComment.save();
//         await newComment.populate('user', 'username email name');

//         await logActivity(id, userId, 'added a comment');

//         // 🟢 SOCKET: Phát sự kiện thêm comment mới
//         if (task) {
//             try {
//                 getIO().to(`project_${task.projectId}`).emit("comment_added", newComment);
//             } catch (socketErr) {
//                 console.error("Socket emit error (addComment):", socketErr.message);
//             }
//         }

//         return res.status(201).json(newComment);
//     } catch (err) {
//         return res.status(500).json({ error: err.message });
//     }
// };

// // Activity history
// exports.getTaskActivities = async (req, res) => {
//     try {
//         const taskId = req.params.taskId || req.params.id;

//         const activities = await TaskActivity.find({ taskId })
//             .populate('user', 'username name email avatar')
//             .sort({ createdAt: -1 });

//         return res.status(200).json(activities);
//     } catch (error) {
//         return res.status(500).json({
//             message: 'Failed to fetch task activities',
//             error: error.message
//         });
//     }
// };

// // Review task action (Accept / Not Accept)
// exports.reviewTask = async (req, res) => {
//     try {
//         const { id } = req.params;
//         const { action } = req.body; // 'accept' or 'not_accept'
//         const currentUserId = req.user?.id || req.user?._id;

//         const task = await Task.findById(id);
//         if (!task) return res.status(404).json({ message: 'Task not found' });

//         const columns = await Column.find({ projectId: task.projectId });
//         const taskPoints = Number(task.point || 0);
//         const assigneeIds = extractAssigneeIds(task.assignees);

//         if (action === 'not_accept') {
//             const reviewColumn = columns.find(c => {
//                 const title = (c.title || c.name || '').toLowerCase();
//                 return title.includes('in review') || title.includes('review');
//             });

//             if (reviewColumn) {
//                 task.columnId = reviewColumn._id;
//                 task.status = 'pending';
//                 task.updatedAt = new Date();
//                 await task.save();

//                 if (taskPoints > 0 && assigneeIds.length > 0 && typeof updateAssigneesPoints === 'function') {
//                     await updateAssigneesPoints(assigneeIds, -taskPoints);
//                 }

//                 await logActivity(id, currentUserId, 'rejected task, deducted points and moved back to Review');
//             }
//         } else if (action === 'accept') {
//             const doneColumn = columns.find(c => {
//                 const title = (c.title || c.name || '').toLowerCase();
//                 return title.includes('done') || title.includes('accepted');
//             });

//             if (doneColumn) {
//                 task.columnId = doneColumn._id;
//                 task.status = 'completed';
//                 task.updatedAt = new Date();
//                 await task.save();

//                 if (taskPoints > 0 && assigneeIds.length > 0 && typeof updateAssigneesPoints === 'function') {
//                     await updateAssigneesPoints(assigneeIds, taskPoints);
//                 }

//                 await logActivity(id, currentUserId, 'accepted task');
//             }
//         }

//         // 🟢 SOCKET: Bắn sự kiện task_reviewed
//         try {
//             getIO().to(`project_${task.projectId}`).emit("task_reviewed", { taskId: id, action, task });
//         } catch (socketErr) {
//             console.error("Socket emit error (reviewTask):", socketErr.message);
//         }

//         return res.status(200).json({ message: 'Status updated successfully', task });
//     } catch (err) {
//         return res.status(500).json({ error: err.message });
//     }
// };

// exports.getMyTasks = async (req, res) => {
//     try {
//         const currentUserId = req.user.id;

//         const myTasks = await Task.find({ assignees: currentUserId })
//             .populate({
//                 path: 'projectId',
//                 select: 'name color description'
//             })
//             .populate({
//                 path: 'columnId',
//                 select: 'title position'
//             })
//             .sort({ updatedAt: -1 });
//         return res.status(200).json(myTasks);

//     } catch (error) {
//         console.error("Lỗi tại getMyTasks Controller:", error);
//         return res.status(500).json({
//             message: 'Đã xảy ra lỗi hệ thống khi lấy danh sách công việc!',
//             error: error.message
//         });
//     }
// };

// exports.getTaskCountByWeek = async (req, res) => {
//     try {
//         const { projectId } = req.params;

//         if (!mongoose.Types.ObjectId.isValid(projectId)) {
//             return res.status(400).json({ success: false, message: 'Invalid Project ID' });
//         }

//         const result = await Task.aggregate([
//             {
//                 $match: {
//                     projectId: new mongoose.Types.ObjectId(projectId)
//                 }
//             },
//             {
//                 $group: {
//                     _id: "$week",
//                     count: { $sum: 1 }                 }             },             {$sort: { _id: 1 }
//             }
//         ]);

//         const formattedData = result.map(item => ({
//             week: item._id ? `Tuần ${item._id}` : 'Chưa phân tuần',
//             weekNumber: item._id || 0,
//             tasks: item.count
//         }));

//         return res.status(200).json({
//             success: true,
//             data: formattedData
//         });
//     } catch (error) {
//         console.error("Error fetching tasks by week:", error);
//         return res.status(500).json({ success: false, message: 'Server error' });
//     }
// };

// exports.getTaskCountByStatus = async (req, res) => {
//     try {
//         const { projectId } = req.params;

//         const tasks = await Task.find({ projectId }).populate('columnId', 'position title');

//         const counts = {
//             Backlog: 0,
//             'To Do': 0,
//             'In Progress': 0,
//             Review: 0,
//             Done: 0
//         };

//         tasks.forEach(task => {
//             if (!task.columnId) {
//                 counts['Backlog']++;
//             } else {
//                 const position = task.columnId.position;
//                 switch (position) {
//                     case 0:
//                         counts['To Do']++;
//                         break;
//                     case 1:
//                         counts['In Progress']++;
//                         break;
//                     case 2:
//                         counts['Review']++;
//                         break;
//                     case 3:
//                         counts['Done']++;
//                         break;
//                     default:
//                         counts['Backlog']++;
//                         break;
//                 }
//             }
//         });

//         const chartData = [
//             { status: 'Backlog', tasks: counts['Backlog'], color: '#ef4444' },
//             { status: 'To Do', tasks: counts['To Do'], color: '#3b82f6' },
//             { status: 'In Progress', tasks: counts['In Progress'], color: '#22c55e' },
//             { status: 'Review', tasks: counts['Review'], color: '#06b6d4' },
//             { status: 'Done', tasks: counts['Done'], color: '#a855f7' }
//         ];

//         return res.status(200).json({ success: true, data: chartData });
//     } catch (error) {
//         console.error("Error fetching chart data:", error);
//         return res.status(500).json({ success: false, message: 'Lỗi server' });
//     }
// };

// // 3. Cycle Time By Week
// exports.getCycleTimeByWeek = async (req, res) => {
//     try {
//         const { projectId } = req.params;
//         if (!mongoose.Types.ObjectId.isValid(projectId)) {
//             return res.status(400).json({ success: false, message: 'Invalid Project ID' });
//         }

//         const result = await Task.aggregate([
//             { $match: { projectId: new mongoose.Types.ObjectId(projectId), status: "completed" } },
//             {
//                 $project: {
//                     week: 1,
//                     cycleTime: {
//                         $divide: [
//                             { $subtract: ["$updatedAt", "$createdAt"] },
//                             1000 * 60 * 60 * 24 // ngày
//                         ]
//                     }
//                 }
//             },
//             {
//                 $group: {
//                     _id: "$week",
//                     avgCycleTime: { $avg: "$cycleTime" },
//                     minCycleTime: { $min: "$cycleTime" },
//                     maxCycleTime: { $max: "$cycleTime" }
//                 }
//             },
//             { $sort: { _id: 1 } }
//         ]);

//         const formattedData = result.map(item => ({
//             weekLabel: `Tuần ${item._id}`,
//             week: item._id,
//             avgCycleTime: item.avgCycleTime.toFixed(2),
//             minCycleTime: item.minCycleTime.toFixed(2),
//             maxCycleTime: item.maxCycleTime.toFixed(2)
//         }));

//         return res.status(200).json({ success: true, data: formattedData });
//     } catch (error) {
//         console.error("Error fetching cycle time:", error);
//         return res.status(500).json({ success: false, message: 'Server error' });
//     }
// };

// // 4. Epic Burndown Chart
// exports.getEpicBurndown = async (req, res) => {
//     try {
//         const { projectId } = req.params;
//         if (!mongoose.Types.ObjectId.isValid(projectId)) {
//             return res.status(400).json({ success: false, message: 'Invalid Project ID' });
//         }

//         const result = await Task.aggregate([
//             { $match: { projectId: new mongoose.Types.ObjectId(projectId) } },
//             {
//                 $group: {
//                     _id: "$week",
//                     totalPoints: { $sum: "$point" },
//                     completedPoints: {
//                         $sum: { $cond: [{$eq: ["$status", "completed"] }, "$point", 0] }
//                     }
//                 }
//             },
//             { $sort: { _id: 1 } }
//         ]);

//         const formattedData = result.map(item => ({
//             weekLabel: `Tuần ${item._id}`,
//             week: item._id,
//             totalPoints: item.totalPoints,
//             completedPoints: item.completedPoints,
//             remainingPoints: item.totalPoints - item.completedPoints
//         }));

//         return res.status(200).json({ success: true, data: formattedData });
//     } catch (error) {
//         console.error("Error fetching epic burndown:", error);
//         return res.status(500).json({ success: false, message: 'Server error' });
//     }
// };


const Task = require('./../model/task');
const Column = require('./../model/column');
const Project = require('./../model/project');
const Comment = require('../model/Comment');
const TaskActivity = require('../model/activity');
const mongoose = require('mongoose');
const { getIO } = require('../socket'); // Import hàm lấy phiên bản socket.io

// Import helper updating user points
const { updateAssigneesPoints } = require('./user');
const { buildEpicBurndown } = require('../helper/epicBurndown');

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

        // 🟢 SOCKET: Phát sự kiện tạo task mới cho tất cả client trong dự án
        try {
            getIO().to(`project_${projectId}`).emit("task_created", newTask);
        } catch (socketErr) {
            console.error("Socket emit error (createTask):", socketErr.message);
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

        const updateFields = { ...req.body };

        if (req.body.point !== undefined) {
            updateFields.point = Number(req.body.point || 0);
        }
        if (req.body.week !== undefined) {
            updateFields.week = Number(req.body.week || 1);
        }

        // 🟢 KIỂM TRA TRỰC TIẾP QUA TITLE / NAME CỦA CỘT
        if (req.body.columnId && String(req.body.columnId) !== String(task.columnId)) {
            const targetCol = await Column.findById(req.body.columnId);

            if (targetCol) {
                // Lấy giá trị tiêu đề cột (chấp nhận cả title lẫn name)
                const colTitle = String(targetCol.title || targetCol.name || "").trim().toLowerCase();

                // Kiểm tra xem tiêu đề cột có chứa 'done' hoặc 'hoàn thành' không
                const isDoneColumn = colTitle.includes("done") || colTitle.includes("hoàn thành");

                if (isDoneColumn) {
                    const currentDate = new Date();
                    // Lưu ngày hiện tại nếu chưa có
                    updateFields.completedAt = task.completedAt || currentDate;
                    updateFields.completedDate = task.completedDate || currentDate;
                } else {
                    // Nếu kéo sang cột khác Done -> Reset về null
                    updateFields.completedAt = null;
                    updateFields.completedDate = null;
                }
            }
        }

        // Cập nhật vào DB
        const updatedTask = await Task.findByIdAndUpdate(
            taskId,
            { $set: updateFields },
            { new: true, runValidators: true }
        ).populate('assignees', 'username name email');

        // Ghi Log Activity
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

        // 🟢 SOCKET: Bắn sự kiện task_updated cho cả project
        try {
            getIO().to(`project_${task.projectId}`).emit("task_updated", updatedTask);
        } catch (socketErr) {
            console.error("Socket emit error (updateTask):", socketErr.message);
        }

        return res.json(updatedTask);
    } catch (err) {
        console.error("Error updating task:", err);
        return res.status(500).json({ error: err.message });
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

        // 🟢 SOCKET: Bắn sự kiện task_deleted cho cả project
        try {
            getIO().to(`project_${task.projectId}`).emit("task_deleted", { taskId });
        } catch (socketErr) {
            console.error("Socket emit error (deleteTask):", socketErr.message);
        }

        return res.json({ message: 'Task deleted successfully', id: taskId });
    } catch (err) {
        console.error('Delete Task Error:', err);
        return res.status(500).json({ error: err.message });
    }
};

// Move task between columns & adjust user points
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

        const destTitle = String(destCol.title || destCol.name || '').trim().toLowerCase();
        const sourceTitle = sourceCol ? String(sourceCol.title || sourceCol.name || '').trim().toLowerCase() : '';

        // Kiểm tra cột có phải Done/Hoàn thành không (không phụ thuộc position)
        const isDestDone = destTitle.includes('done') || destTitle.includes('accepted') || destTitle.includes('finish') || destTitle.includes('hoàn thành');
        const isSourceDone = sourceTitle.includes('done') || sourceTitle.includes('accepted') || sourceTitle.includes('finish') || sourceTitle.includes('hoàn thành');

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
        if (isDestDone && !isSourceDone) {
            task.status = 'completed';
            task.completedAt = new Date();
        } else if (!isDestDone && isSourceDone) {
            task.status = 'pending';
            task.completedAt = null;
        }

        if (sourceCol) {
            sourceCol.taskOrderIds = sourceCol.taskOrderIds.filter(id => id.toString() !== taskId.toString());
            await sourceCol.save();
        }

        const destOrder = destCol.taskOrderIds.map(id => id.toString()).filter(id => id !== taskId.toString());
        const validIndex = Math.max(0, Math.min(destinationIndex || 0, destOrder.length));
        destOrder.splice(validIndex, 0, taskId);
        destCol.taskOrderIds = destOrder;

        // Cập nhật columnId và reset mốc updatedAt
        task.columnId = destColumnId;
        task.updatedAt = new Date();

        // 🟢 CẬP NHẬT COMPLETEDAT & COMPLETEDDATE KHI DI CHUYỂN
        if (isDestDone) {
            const currentDate = new Date();
            task.completedAt = task.completedAt || currentDate;
            task.completedDate = task.completedDate || currentDate;
        } else {
            // Khi di chuyển ra khỏi cột Done -> Đưa về null
            task.completedAt = null;
            task.completedDate = null;
        }

        await Promise.all([destCol.save(), task.save()]);

        if (currentUserId) {
            await logActivity(taskId, currentUserId, `moved task to column "${destCol.title || destCol.name}"`);
        }

        // 🟢 SOCKET: Bắn sự kiện task_moved tới phòng của Project này
        try {
            getIO().to(`project_${task.projectId}`).emit("task_moved", {
                taskId,
                sourceColumnId,
                destColumnId,
                destinationIndex,
                task // Trả kèm task object đã cập nhật completedAt/completedDate
            });
        } catch (socketErr) {
            console.error("Socket emit error (moveTask):", socketErr.message);
        }

        return res.status(200).json({ message: 'Task position updated successfully', taskId, task });
    } catch (err) {
        console.error('Error moving task:', err);
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

        const updateFields = { ...req.body };

        if (req.body.point !== undefined) {
            updateFields.point = Number(req.body.point || 0);
        }
        if (req.body.week !== undefined) {
            updateFields.week = Number(req.body.week || 1);
        }

        // 🟢 KIỂM TRA TRỰC TIẾP QUA TITLE / NAME CỦA CỘT KHI DÙNG UPDATETASK
        if (req.body.columnId && String(req.body.columnId) !== String(task.columnId)) {
            const targetCol = await Column.findById(req.body.columnId);

            if (targetCol) {
                const colTitle = String(targetCol.title || targetCol.name || "").trim().toLowerCase();
                const isDoneColumn = colTitle.includes("done") || colTitle.includes("accepted") || colTitle.includes("finish") || colTitle.includes("hoàn thành");

                if (isDoneColumn) {
                    const currentDate = new Date();
                    updateFields.completedAt = task.completedAt || currentDate;
                    updateFields.completedDate = task.completedDate || currentDate;
                } else {
                    updateFields.completedAt = null;
                    updateFields.completedDate = null;
                }
            }
        }

        // Cập nhật vào DB
        const updatedTask = await Task.findByIdAndUpdate(
            taskId,
            { $set: updateFields },
            { new: true, runValidators: true }
        ).populate('assignees', 'username name email');

        // Ghi Log Activity
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

        // 🟢 SOCKET: Bắn sự kiện task_updated cho cả project
        try {
            getIO().to(`project_${task.projectId}`).emit("task_updated", updatedTask);
        } catch (socketErr) {
            console.error("Socket emit error (updateTask):", socketErr.message);
        }

        return res.json(updatedTask);
    } catch (err) {
        console.error("Error updating task:", err);
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

        // 🟢 SOCKET
        try {
            getIO().to(`project_${task.projectId}`).emit("task_updated", updatedTask);
        } catch (socketErr) {
            console.error("Socket emit error:", socketErr.message);
        }

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

        // 🟢 SOCKET
        try {
            getIO().to(`project_${task.projectId}`).emit("task_updated", task);
        } catch (socketErr) {
            console.error("Socket emit error:", socketErr.message);
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

        // 🟢 SOCKET
        try {
            getIO().to(`project_${updatedTask.projectId}`).emit("task_updated", updatedTask);
        } catch (socketErr) {
            console.error("Socket emit error:", socketErr.message);
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

        const task = await Task.findById(id);

        const newComment = new Comment({
            taskId: id,
            user: userId,
            text: text.trim()
        });

        await newComment.save();
        await newComment.populate('user', 'username email name');

        await logActivity(id, userId, 'added a comment');

        // 🟢 SOCKET: Phát sự kiện thêm comment mới
        if (task) {
            try {
                getIO().to(`project_${task.projectId}`).emit("comment_added", newComment);
            } catch (socketErr) {
                console.error("Socket emit error (addComment):", socketErr.message);
            }
        }

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

exports.Portfolio = async (req, res) => {
    try {
        const projects = await Project.find();

        let totalCompletedWeeks = 0; // Tổng số tuần đã diễn ra của tất cả project
        let totalOnTimeWeeks = 0;     // Tổng số tuần đạt hoặc vượt Plan Progress

        for (const project of projects) {
            const projectId = project._id;

            // 1. Tìm cột Done của dự án
            const doneColumn = await Column.findOne({
                projectId,
                $or: [
                    { position: 3 },
                    { title: { $regex: /done|accepted|finish|hoàn thành/i } },
                    { name: { $regex: /done|accepted|finish|hoàn thành/i } }
                ]
            });
            const doneColumnId = doneColumn ? String(doneColumn._id) : null;

            // 2. Lấy tất cả task của project
            const tasks = await Task.find({ projectId });
            if (tasks.length === 0) continue;

            // 3. Xác định ngày bắt đầu & tuần hiện tại
            let minStartDate = null;
            let maxProjectWeek = 1;

            tasks.forEach(t => {
                if (t.createdAt) {
                    const cTime = new Date(t.createdAt).getTime();
                    if (!minStartDate || cTime < minStartDate) minStartDate = cTime;
                }
                const taskWeekNum = Number(t.week || 1);
                if (taskWeekNum > maxProjectWeek) maxProjectWeek = taskWeekNum;
            });

            const projectStartDate = minStartDate ? new Date(minStartDate) : new Date(project.startDate || Date.now());
            const now = new Date();
            const diffInDays = Math.max(0, Math.floor((now.getTime() - projectStartDate.getTime()) / (1000 * 60 * 60 * 24)));
            const currentProjectWeek = Math.floor(diffInDays / 7) + 1;

            // Helper lấy mốc hết tuần
            const getWeekEndTimestamp = (w) => {
                const endDate = new Date(projectStartDate.getTime());
                endDate.setDate(endDate.getDate() + (w * 7));
                return endDate.getTime();
            };

            // 4. Duyệt các tuần ĐÃ DIỄN RA (từ tuần 1 đến currentProjectWeek)
            const weeksToEvaluate = Math.min(currentProjectWeek, maxProjectWeek);

            for (let w = 1; w <= weeksToEvaluate; w++) {
                const weekEndMs = getWeekEndTimestamp(w);

                // Điểm Plan dồn tích lũy đến tuần w
                const planPoints = tasks
                    .filter(t => Number(t.week || 1) <= w)
                    .reduce((sum, t) => sum + Number(t.point || 0), 0);

                // Điểm Real Progress dồn tích lũy đến tuần w
                const realPoints = tasks
                    .filter(t => {
                        const isDone = doneColumnId && String(t.columnId) === doneColumnId;
                        const actualCompletedDate = t.completedDate || t.completedAt;
                        if (!isDone || !actualCompletedDate) return false;
                        return new Date(actualCompletedDate).getTime() <= weekEndMs;
                    })
                    .reduce((sum, t) => sum + Number(t.point || 0), 0);

                totalCompletedWeeks += 1;

                // Điều kiện On-time: Real Progress >= Plan Progress
                if (realPoints >= planPoints) {
                    totalOnTimeWeeks += 1;
                }
            }
        }

        // 5. Tính % On-time Rate của toàn bộ Project
        const onTimeRate = totalCompletedWeeks > 0
            ? Math.round((totalOnTimeWeeks / totalCompletedWeeks) * 100)
            : 100;

        return res.status(200).json({
            totalProjects: projects.length,
            totalCompletedWeeks,
            totalOnTimeWeeks,
            onTimeRate: parseFloat(onTimeRate)
        });

    } catch (error) {
        console.error("Lỗi tính On-Time Rate:", error);
        return res.status(500).json({ message: "Lỗi hệ thống tính toán Portfolio", error: error.message });
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

            if (!reviewColumn) {
                return res.status(404).json({ message: 'Review column not found' });
            }

            // Chỉ trừ điểm nếu task trước đó đã được tính hoàn thành
            const wasCompleted = task.status === 'completed';

            task.columnId = reviewColumn._id;
            task.status = 'pending';
            task.completedAt = null;
            task.updatedAt = new Date();
            await task.save();

            if (wasCompleted && taskPoints > 0 && assigneeIds.length > 0 && typeof updateAssigneesPoints === 'function') {
                await updateAssigneesPoints(assigneeIds, -taskPoints);
            }

            await logActivity(id, currentUserId, 'rejected task and moved back to Review');
        } else if (action === 'accept') {
            // Tránh cộng điểm 2 lần nếu task đã được accept
            if (task.status === 'completed') {
                return res.status(200).json({ message: 'Task already accepted', task });
            }

            const doneColumn = columns.find(c => {
                const title = (c.title || c.name || '').toLowerCase();
                return title.includes('done') || title.includes('accepted');
            });

            if (!doneColumn) {
                return res.status(404).json({ message: 'Done column not found' });
            }

            task.columnId = doneColumn._id;
            task.status = 'completed';
            task.completedAt = new Date();
            task.updatedAt = new Date();
            await task.save();

            if (taskPoints > 0 && assigneeIds.length > 0 && typeof updateAssigneesPoints === 'function') {
                await updateAssigneesPoints(assigneeIds, taskPoints);
            }

            await logActivity(id, currentUserId, 'accepted task');
        } else {
            return res.status(400).json({ message: 'Invalid action' });
        }

        // 🟢 SOCKET: Bắn sự kiện task_reviewed
        try {
            getIO().to(`project_${task.projectId}`).emit("task_reviewed", { taskId: id, action, task });
        } catch (socketErr) {
            console.error("Socket emit error (reviewTask):", socketErr.message);
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
};

exports.getTaskCountByWeek = async (req, res) => {
    try {
        const { projectId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(projectId)) {
            return res.status(400).json({ success: false, message: 'Invalid Project ID' });
        }

        const result = await Task.aggregate([
            {
                $match: {
                    projectId: new mongoose.Types.ObjectId(projectId)
                }
            },
            {
                $group: {
                    _id: "$week",
                    count: { $sum: 1 }                 }             },             {$sort: { _id: 1 }
            }
        ]);

        const formattedData = result.map(item => ({
            week: item._id ? `Tuần ${item._id}` : 'Chưa phân tuần',
            weekNumber: item._id || 0,
            tasks: item.count
        }));

        return res.status(200).json({
            success: true,
            data: formattedData
        });
    } catch (error) {
        console.error("Error fetching tasks by week:", error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.getTaskCountByStatus = async (req, res) => {
    try {
        const { projectId } = req.params;

        const tasks = await Task.find({ projectId }).populate('columnId', 'position title');

        const counts = {
            Backlog: 0,
            'To Do': 0,
            'In Progress': 0,
            Review: 0,
            Done: 0
        };

        tasks.forEach(task => {
            if (!task.columnId) {
                counts['Backlog']++;
            } else {
                const position = task.columnId.position;
                switch (position) {
                    case 0:
                        counts['To Do']++;
                        break;
                    case 1:
                        counts['In Progress']++;
                        break;
                    case 2:
                        counts['Review']++;
                        break;
                    case 3:
                        counts['Done']++;
                        break;
                    default:
                        counts['Backlog']++;
                        break;
                }
            }
        });

        const chartData = [
            { status: 'Backlog', tasks: counts['Backlog'], color: '#ef4444' },
            { status: 'To Do', tasks: counts['To Do'], color: '#3b82f6' },
            { status: 'In Progress', tasks: counts['In Progress'], color: '#22c55e' },
            { status: 'Review', tasks: counts['Review'], color: '#06b6d4' },
            { status: 'Done', tasks: counts['Done'], color: '#a855f7' }
        ];

        return res.status(200).json({ success: true, data: chartData });
    } catch (error) {
        console.error("Error fetching chart data:", error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// 3. Cycle Time By Week
exports.getCycleTimeByWeek = async (req, res) => {
    try {
        const { projectId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(projectId)) {
            return res.status(400).json({ success: false, message: 'Invalid Project ID' });
        }

        const result = await Task.aggregate([
            { $match: { projectId: new mongoose.Types.ObjectId(projectId), status: "completed" } },
            {
                $project: {
                    week: 1,
                    cycleTime: {
                        $divide: [
                            { $subtract: ["$updatedAt", "$createdAt"] },
                            1000 * 60 * 60 * 24 // ngày
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: "$week",
                    avgCycleTime: { $avg: "$cycleTime" },
                    minCycleTime: { $min: "$cycleTime" },
                    maxCycleTime: { $max: "$cycleTime" }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        const formattedData = result.map(item => ({
            weekLabel: `Tuần ${item._id}`,
            week: item._id,
            avgCycleTime: item.avgCycleTime.toFixed(2),
            minCycleTime: item.minCycleTime.toFixed(2),
            maxCycleTime: item.maxCycleTime.toFixed(2)
        }));

        return res.status(200).json({ success: true, data: formattedData });
    } catch (error) {
        console.error("Error fetching cycle time:", error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

// 4. Epic Burndown Chart
function getCurrentWeekNumber(startDateStr) {
    if (!startDateStr) return 1;
    const startDate = new Date(startDateStr);
    const now = new Date();
    const diffInDays = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
    const currentWeek = Math.floor(diffInDays / 7) + 1;
    return Math.max(1, currentWeek);
}

exports.getEpicBurndown = async (req, res) => {
    try {
        const { projectId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(projectId)) {
            return res.status(400).json({ success: false, message: 'Invalid Project ID' });
        }

        const project = await Project.findById(projectId).select('startDate createdAt');
        if (!project) {
            return res.status(404).json({ success: false, message: 'Project not found' });
        }

        const tasks = await Task.find({ projectId }).select('point status completedAt updatedAt createdAt');

        const now = new Date();
        const startDate = project.startDate || project.createdAt || now;

        res.json(buildEpicBurndown(tasks, startDate, now));
    } catch (error) {
        res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
};

// Controller tính Real Progress cộng dồn cho tất cả task có completedDate
exports.getWeeklyExpectancy = async (req, res) => {
    try {
        const { projectId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(projectId)) {
            return res.status(400).json({ success: false, message: 'Invalid Project ID' });
        }

        const projectObjectId = new mongoose.Types.ObjectId(projectId);

        // 1. Tìm cột đại diện cho trạng thái Done
        const doneColumn = await Column.findOne({
            projectId: projectObjectId,
            $or: [
                { position: 3 },
                { title: { $regex: /done|accepted|finish|hoàn thành/i } },
                { name: { $regex: /done|accepted|finish|hoàn thành/i } }
            ]
        });

        const doneColumnId = doneColumn ? String(doneColumn._id) : null;

        // 2. Lấy toàn bộ task của Project
        const tasks = await Task.find({ projectId: projectObjectId });

        if (tasks.length === 0) {
            return res.status(200).json({ success: true, weeks: [] });
        }

        // 3. Tìm ngày bắt đầu dự án & Xác định week kế hoạch lớn nhất (maxProjectWeek)
        let minStartDate = null;
        let maxProjectWeek = 1;

        tasks.forEach(t => {
            if (t.createdAt) {
                const cTime = new Date(t.createdAt).getTime();
                if (!minStartDate || cTime < minStartDate) {
                    minStartDate = cTime;
                }
            }

            const taskWeekNum = Number(t.week || 1);
            if (taskWeekNum > maxProjectWeek) {
                maxProjectWeek = taskWeekNum;
            }
        });

        const projectStartDate = minStartDate ? new Date(minStartDate) : new Date();

        // 4. Tính Tuần thời gian thực hiện tại của dự án
        const now = new Date();
        const diffInMs = now.getTime() - projectStartDate.getTime();
        const diffInDays = Math.max(0, Math.floor(diffInMs / (1000 * 60 * 60 * 24)));
        const currentProjectWeek = Math.floor(diffInDays / 7) + 1;

        // Helper: Lấy mốc thời gian kết thúc của một Tuần (Hết ngày thứ 7 của tuần đó)
        const getWeekEndTimestamp = (weekNum) => {
            const endDate = new Date(projectStartDate.getTime());
            endDate.setDate(endDate.getDate() + (weekNum * 7));
            return endDate.getTime();
        };

        // 🟢 5. TÍNH ĐIỂM PLAN CỘNG DỒN VÀ REAL PROGRESS CỘNG DỒN
        const weeksData = [];

        for (let w = 1; w <= maxProjectWeek; w++) {
            const weekEndMs = getWeekEndTimestamp(w);

            // A. PLAN PROGRESS (Cộng dồn kế hoạch từ Week 1 -> Week w)
            const planPoints = tasks
                .filter(t => Number(t.week || 1) <= w)
                .reduce((sum, t) => sum + Number(t.point || 0), 0);

            // B. REAL PROGRESS (Cộng dồn TẤT CẢ task đã Done có completedDate <= Mốc thời gian cuối của Week w)
            let realPoints = null;

            if (w <= currentProjectWeek) {
                realPoints = tasks
                    .filter(t => {
                        const isDone = doneColumnId && String(t.columnId) === doneColumnId;
                        const actualCompletedDate = t.completedDate || t.completedAt;

                        if (!isDone || !actualCompletedDate) return false;

                        // Nếu task có completedDate thực tế rơi vào trước hoặc trong Week w -> CỘNG VÀO
                        return new Date(actualCompletedDate).getTime() <= weekEndMs;
                    })
                    .reduce((sum, t) => sum + Number(t.point || 0), 0);
            }

            weeksData.push({
                week: `Week ${w}`,
                weekNumber: w,
                expectancy: planPoints,   // Plan dồn tích lũy
                realProgress: realPoints   // Real Progress giữ nguyên & cộng dồn tích lũy
            });
        }

        return res.status(200).json({
            success: true,
            currentProjectWeek,
            maxProjectWeek,
            weeks: weeksData
        });
    } catch (error) {
        console.error("Lỗi getWeeklyExpectancy:", error);
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};
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

exports.getTasksByProject = async (req, res) => {
    try {
        const { projectId } = req.query;

        const filter = projectId ? { projectId } : {};
        const tasks = await Task.find(filter).populate('assignee', 'username email');

        res.status(200).json(tasks);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createTask = async (req, res) => {
    try {
        const { title, description, columnId, assignees, priority, date } = req.body;
        const currentUserId = req.user.id;

        if (!title || !title.trim()) {
            return res.status(400).json({ message: 'Task title is required' });
        }
        if (!columnId) {
            return res.status(400).json({ message: 'Please select a column' });
        }

        const column = await Column.findById(columnId);
        if (!column) {
            return res.status(404).json({ message: 'Selected column does not exist' });
        }

        const project = await Project.findOne({ _id: column.projectId, userId: currentUserId });
        if (!project) {
            return res.status(403).json({ message: 'Unauthorized: You do not own this project' });
        }

        const taskAssignees = Array.isArray(assignees) ? assignees : [];
        if (taskAssignees.length > 0) {
            const validProjectMembers = [
                project.userId.toString(),
                ...(project.assignees || []).map(id => id.toString())
            ];

            const isValid = taskAssignees.every(memberId => validProjectMembers.includes(memberId.toString()));
            if (!isValid) {
                return res.status(400).json({
                    message: 'Some assignees do not belong to this project'
                });
            }
        }

        const newTask = new Task({
            title: title.trim(),
            description: description || '',
            columnId,
            assignees: taskAssignees,
            priority: priority || 'Medium',
            date: date || null
        });

        await newTask.save();

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
        res.json({ message: 'Task deleted successfully', id: taskId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.moveTask = async (req, res) => {
    try {
        const { id } = req.params;
        const { columnId, position } = req.body;
        const currentUserId = req.user.id;

        const task = await Task.findById(id);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        const column = await Column.findById(task.columnId);
        const project = await Project.findOne({ _id: column.projectId, userId: currentUserId });
        if (!project) {
            return res.status(403).json({ message: 'Unauthorized to move this task' });
        }

        if (columnId !== undefined) task.columnId = columnId;
        if (position !== undefined) task.position = position;

        await task.save();
        res.json({ message: 'Task moved successfully', task });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
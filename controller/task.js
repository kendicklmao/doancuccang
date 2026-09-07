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

exports.createTask = async (req, res) => {
    try {
        const { title, description, columnId, priority, date } = req.body;
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

        const newTask = new Task({
            title: title.trim(),
            description: description || '',
            columnId,
            priority: priority || 'Medium',
            date: date
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
        const updatedTask = await Task.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!updatedTask) {
            return res.status(404).json({ message: 'not found' });
        }

        res.json(updatedTask);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.deleteTask = async (req, res) => {
    try {
        const deletedTask = await Task.findByIdAndDelete(req.params.id);
        if (!deletedTask) {
            return res.status(404).json({ message: 'not found' });
        }
        res.json({ message: 'deleted', id: req.params.id });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.moveTask = async (req, res) => {
    try {
        const { id } = req.params;
        const { columnId, position } = req.body;

        const task = await Task.findById(id);
        if (!task) {
            return res.status(404).json({ message: 'Không tìm thấy task!' });
        }

        task.columnId = columnId !== undefined ? columnId : task.columnId;
        task.position = position !== undefined ? position : task.position;

        await task.save();
        res.json({ message: 'updated', task });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
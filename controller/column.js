const Column = require('./../model/column');
const Task = require('./../model/task');

exports.getColumn = async (req, res) => {
    try {
        const columns = await Column.find().sort('position');
        res.json(columns);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getColumnById = async (req, res) => {
    try {
        const column = await Column.findById(req.params.id);
        if (!column) {
            return res.status(404).json({ message: 'not found' });
        }
        res.json(column);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.createColumn = async (req, res) => {
    try {
        if (req.body.position === undefined) {
            const count = await Column.countDocuments();
            req.body.position = count;
        }

        const newColumn = new Column(req.body);
        await newColumn.save();
        res.status(201).json(newColumn);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.deleteColumn = async (req, res) => {
    try {
        const columnId = req.params.id;
        const currentUserId = req.user.id;

        const column = await Column.findById(columnId);
        if (!column) {
            return res.status(404).json({ message: 'Column not found' });
        }

        const project = await Project.findOne({ _id: column.projectId, userId: currentUserId });
        if (!project) {
            return res.status(403).json({ message: 'Unauthorized to delete column in this project' });
        }

        await Task.deleteMany({ columnId: columnId });

        await Column.findByIdAndDelete(columnId);

        res.json({ message: 'Column and all associated tasks deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};





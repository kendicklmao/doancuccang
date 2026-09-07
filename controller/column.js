const Column = require('./../model/Column');

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





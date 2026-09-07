const Column = require('./../model/column');

exports.getColumn = async (req, res) => {
    try {
        const columns = await Column.find().sort('position');
        res.json(columns);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
}

exports.createColumn = async (req, res) => {
    try {
        const newColumn = new Column(req.body);
        await newColumn.save();
        res.status(201).json(newColumn);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
}
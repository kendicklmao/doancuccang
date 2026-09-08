const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    title: {
        type: String, required: true
    },
    description: {
        type: String,
        default: ''
    },
    columnId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Column',
        required: true
    },
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Urgent'],
        default: 'Medium'
    },
    date: {
        type: Date,
        default: Date.now
    },
}, { timestamps: true });

module.exports = mongoose.model('Task', taskSchema);
const mongoose = require('mongoose');
const checklistItemSchema = require('./Checklist'); // Import Schema checklist nếu tách file

const taskSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
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
    assignees: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Urgent'],
        default: 'Medium'
    },
    date: {
        type: Date,
        default: Date.now
    },
    checklist: [checklistItemSchema]
}, { timestamps: true });

module.exports = mongoose.model('Task', taskSchema);
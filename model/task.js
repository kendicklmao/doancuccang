const mongoose = require('mongoose');
const checklistItemSchema = require('./checklist');

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
        default: null
    },
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
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
    checklist: [checklistItemSchema],

    point: {
        type: Number,
        default: 0
    },
    // startDate: {
    //     type: Date,
    //     default: Date.now
    // },
    // dueDate: {
    //     type: Date
    // },

    week: {
        type: Number,
        default: 1
    },
    status: {
        type: String,
        default: "pending"
    }
},
    { timestamps: true });

module.exports = mongoose.model('Task', taskSchema);
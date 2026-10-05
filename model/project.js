const mongoose = require('mongoose');
const documentSchema = require('./document');

const projectSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    description: {
        type: String,
        default: ''
    },
    date: {
        type: Date,
        default: Date.now
    },
    color: {
        type: String,
        default: '#4f46e5'
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    startDate: {
        type: Date,
        default: Date.now
    },
    assignees: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Member',
    }],
    documents: [documentSchema],
    projectDetail: {
        type: String,
        default: ''
    },
    budget: { type: Number, default: 0 }, 
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

module.exports = mongoose.model('Project', projectSchema);
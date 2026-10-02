const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true
    },
    content: {
        type: String,
        required: true,
        trim: true
    },
    date: {
        type: String, // Định dạng YYYY-MM-DD
        required: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, { timestamps: true });

module.exports = mongoose.model('Note', noteSchema);
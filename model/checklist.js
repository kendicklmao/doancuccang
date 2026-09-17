const mongoose = require('mongoose');

const checklistItemSchema = new mongoose.Schema({
    text: {
        type: String,
        required: true
    },
    completed: {
        type: Boolean,
        default: false
    }
});

module.exports = checklistItemSchema;
const mongoose = require('mongoose');

const columnSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    position: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

module.exports = mongoose.model('Column', columnSchema);
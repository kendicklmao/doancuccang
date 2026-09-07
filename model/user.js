const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'enter username'],
        unique: true,
        trim: true
    },
    email: {
        type: String,
        required: [true, 'enter email'],
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: [true, 'enter password'],
        minlength: 6
    },
    role: {
        type: String,
        enum: ['member'],
        default: 'member'
    }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
const mongoose = require("mongoose");
const MembershipSchema = new mongoose.Schema({
    projectId :{
        type: mongoose.Schema.Types.ObjectId,
        ref:'Project',
        require:true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', 
        required: true
    },
     role: {
        type: String,
        enum: ['Leader', 'Member'], 
        default: 'Member'
    },
    position: {
        type: String,
        enum: ['dev', 'tester', 'manager'],
        default: 'dev'
    }
}, 
    { timestamps: true });

MembershipSchema.index({ projectId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Membership', MembershipSchema);
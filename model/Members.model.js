const mongoose = require("mongoose");
const MemberSchema = new mongoose.Schema({
    // projectId :{
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref:'Project',
    //     require:true
    // },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', 
        required: true
    },
     role: {
        type: String,
        enum: ['Leader', 'Member','Manager'], 
        default: 'Member'
    },
    position: {
        type: String,
        enum: ['Dev', 'Tester','None'],
        default: "None"
    }
}, 
    { timestamps: true });

MemberSchema.index({ projectId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Members', MemberSchema);
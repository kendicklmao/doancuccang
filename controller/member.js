const mongoose = require('mongoose');
const Member = require('../model/member'); // Đường dẫn tới Model Member của bạn
const User = require('../model/user');     // Đường dẫn tới Model User
const Project = require('../model/project'); // Đường dẫn tới Model Project (để dọn dẹp data nếu xóa member)
const Task = require('../model/task');       // Đường dẫn tới Model Task


/**
 * Lấy danh sách tất cả Members (có populate thông tin User)
 */
exports.getMembers = async (req, res) => {
    try {
        const members = await Member.find()
            .populate('userId', '_id username email avatar role')
            .sort({ createdAt: -1 });

        return res.status(200).json(members);
    } catch (error) {
        console.error("Lỗi getMembers:", error);
        return res.status(500).json({ message: 'Lỗi Server', error: error.message });
    }
};

/**
 * Lấy thông tin chi tiết của 1 Member theo ID
 */
// memberController.js
exports.getMembersByProject = async (req, res) => {
    try {
        const { id } = req.params; // id chính là projectId dạng String

        // Thêm 'points' (hoặc 'point') vào thuộc tính lấy ra từ User
        const members = await Member.find({ projectId: new mongoose.Types.ObjectId(id) })
            .populate('userId', '_id username email avatar role point')
            .sort({ createdAt: -1 });

        return res.status(200).json(members);
    } catch (error) {
        console.error("Lỗi getMembersByProject:", error);
        return res.status(500).json({ message: 'Lỗi Server', error: error.message });
    }
};

/**
 * Mời / Thêm Member mới vào Hệ thống dựa trên Email
 */
exports.inviteMember = async (req, res) => {
    try {
        const { email, role, projectId } = req.body; // <--- Lấy thêm projectId
        if (!email) return res.status(400).json({ message: 'Email is required' });

        const user = await User.findOne({ email: email.trim().toLowerCase() });
        if (!user) return res.status(404).json({ message: 'User chưa đăng ký!' });

        // Kiểm tra member đã tồn tại trong PROJECT NÀY chưa
        const existingMember = await Member.findOne({ userId: user._id, projectId: projectId });
        if (existingMember) return res.status(400).json({ message: 'Đã là thành viên dự án!' });

        const newMember = new Member({
            userId: user._id,
            projectId: projectId, // <--- BỔ SUNG TRƯỜNG NÀY
            role: role || 'Member',
            status: 'Active'
        });

        await newMember.save();
        await newMember.populate('userId', '_id username email avatar role');

        res.status(201).json({ message: 'Invite/Add member successfully', member: newMember });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * Cập nhật thông tin Member (Role, Position, Status)
 */
exports.updateMember = async (req, res) => {
    try {
        const { id } = req.params; // Member ID
        const { role, position, status } = req.body;

        const currentMember = await Member.findById(id);
        if (!currentMember) {
            return res.status(404).json({ message: 'Member not found' });
        }

        const updateData = {};
        let hasAnyChange = false;

        // Kiểm tra thay đổi Role
        if (role !== undefined && role !== currentMember.role) {
            updateData.role = role;
            hasAnyChange = true;
        }

        // Kiểm tra thay đổi Position
        if (position !== undefined && position !== currentMember.position) {
            updateData.position = position;
            hasAnyChange = true;
        }

        // Kiểm tra thay đổi Status
        if (status !== undefined && status !== currentMember.status) {
            updateData.status = status;
            hasAnyChange = true;
        }

        if (!hasAnyChange) {
            return res.status(400).json({ message: 'No changes detected' });
        }

        const updatedMember = await Member.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        ).populate('userId', '_id username email avatar role');

        return res.status(200).json({
            message: 'Member updated successfully',
            member: updatedMember
        });
    } catch (err) {
        console.error("Lỗi updateMember:", err);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * Xóa Member khỏi hệ thống và gỡ liên kết ở các Project / Task
 */
exports.deleteMember = async (req, res) => {
    try {
        const { id } = req.params; // Member ID
        console.log(id);
        const member = await Member.findById(id);
        if (!member) {
            return res.status(404).json({ message: 'Member not found' });
        }

        const targetUserId = member.userId;

        // 1. Xóa Member trong bảng Member
        await Member.findByIdAndDelete(id);

        // 2. Cascade: Tự động gỡ User này khỏi danh sách assignees của các Project và Task
        await Promise.all([
            Project.updateMany(
                { assignees: targetUserId },
                { $pull: { assignees: targetUserId } }
            ),
            Task.updateMany(
                { assignees: targetUserId },
                { $pull: { assignees: targetUserId } }
            )
        ]);

        return res.status(200).json({
            message: 'Member removed and cleaned up from associated projects and tasks successfully'
        });
    } catch (err) {
        console.error("Delete Member Error:", err);
        return res.status(500).json({ error: err.message });
    }
};

exports.updateMembersPoints = async (memberIds, pointsAmount) => {
    console.log('===> Đang chạy updateMembersPoints với IDs:', memberIds, 'Số điểm:', pointsAmount);

    // Kiểm tra dữ liệu đầu vào: phải là mảng không rỗng và pointsAmount phải là số khác 0 (cho phép cộng hoặc trừ)
    if (!Array.isArray(memberIds) || memberIds.length === 0 || !pointsAmount || isNaN(pointsAmount)) {
        console.log('===> Bỏ qua vì thiếu memberIds hoặc pointsAmount không hợp lệ');
        return;
    }

    try {
        // Lọc và chuyển đổi các ID hợp lệ sang ObjectId
        const validObjectIds = memberIds
            .filter(id => mongoose.Types.ObjectId.isValid(id))
            .map(id => new mongoose.Types.ObjectId(id));

        if (validObjectIds.length === 0) {
            console.log('===> Bỏ qua vì không có ObjectId nào hợp lệ');
            return;
        }

        // Cập nhật điểm cho danh sách member trong database
        const result = await User.updateMany(
            { _id: { $in: validObjectIds } },
            { $inc: { point: Number(pointsAmount) } }
        );

        console.log(`===> Đã cập nhật điểm thành công cho ${result.modifiedCount} thành viên.`);
        return result;
    } catch (error) {
        console.error('Lỗi khi cập nhật điểm cho members:', error);
        throw error;
    }
};

exports.getMembersWithWeeklyPoints = async (req, res) => {
    try {
        const { projectId } = req.params;
        const week = Number(req.query.week) || 1; // Mặc định lấy week 1 nếu không truyền

        // 1. Lấy danh sách Member trong Project (populate User để lấy username, email, _id)
        const members = await Member.find({ projectId }).populate('userId', 'username email points');

        // 2. Lấy tất cả Task của Project thuộc week này
        const tasksInWeek = await Task.find({
            projectId,
            week: week
        });

        // 3. Tính tổng point cho từng Member trong week này
        const membersWithPoints = members.map(member => {
            const memberObj = member.toObject();
            const currentUserId = member.userId?._id?.toString() || member.userId?.toString();

            // Lọc ra các task trong week này mà user này được assign
            const userTasks = tasksInWeek.filter(task =>
                task.assignees && task.assignees.some(assigneeId => assigneeId.toString() === currentUserId)
            );

            // Tính tổng điểm các task đó (Có thể lọc thêm theo status === 'completed' nếu chỉ tính task đã hoàn thành)
            const weeklyPoint = userTasks.reduce((sum, task) => sum + (task.point || 0), 0);

            return {
                ...memberObj,
                weeklyPoint // Trả về số điểm riêng của tuần này
            };
        });

        return res.status(200).json({
            success: true,
            week,
            data: membersWithPoints
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
    }
};
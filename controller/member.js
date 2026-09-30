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
exports.getMemberById = async (req, res) => {
    try {
        const { id } = req.params;

        const member = await Member.findById(id)
            .populate('userId', '_id username email avatar role');

        if (!member) {
            return res.status(404).json({ message: 'Member không tồn tại' });
        }

        return res.status(200).json(member);
    } catch (error) {
        console.error("Lỗi getMemberById:", error);
        return res.status(500).json({ message: 'Lỗi Server', error: error.message });
    }
};

/**
 * Mời / Thêm Member mới vào Hệ thống dựa trên Email
 */
exports.inviteMember = async (req, res) => {
   try {
    const { email, role } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) return res.status(404).json({ message: 'User chưa đăng ký!' });

    const existingMember = await Member.findOne({ userId: user._id });
    if (existingMember) return res.status(400).json({ message: 'Đã là thành viên!' });

    const newMember = new Member({
      userId: user._id,
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
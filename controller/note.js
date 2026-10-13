const Note = require('../model/note'); // Đường dẫn tới Model Note của bạn

// 1. Lấy danh sách ghi chú theo projectId
exports.getNotesByProjectId = async (req, res) => {
    try {
        const { projectId } = req.params;
        const notes = await Note.find({ projectId }).populate('createdBy', 'username name email');
        return res.status(200).json(notes);
    } catch (error) {
        return res.status(500).json({ message: 'Lỗi server khi lấy ghi chú', error: error.message });
    }
};

// 2. Tạo ghi chú mới
exports.createNote = async (req, res) => {
    try {
        const { projectId, content, date } = req.body;
        if (!projectId || !content || !date) {
            return res.status(400).json({ message: 'Thiếu thông tin bắt buộc' });
        }

        const newNote = new Note({
            projectId,
            content,
            date,
            createdBy: req.user?._id || req.user?.id
        });

        await newNote.save();
        return res.status(201).json(newNote);
    } catch (error) {
        return res.status(500).json({ message: 'Lỗi server khi tạo ghi chú', error: error.message });
    }
};

// 3. Xóa ghi chú
exports.deleteNote = async (req, res) => {
    try {
        const { id } = req.params;
        await Note.findByIdAndDelete(id);
        return res.status(200).json({ message: 'Đã xóa ghi chú thành công' });
    } catch (error) {
        return res.status(500).json({ message: 'Lỗi server khi xóa ghi chú', error: error.message });
    }
};
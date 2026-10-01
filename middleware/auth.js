const jwt = require('jsonwebtoken');
const Member = require('../model/member'); // Import model Member
const JWT_SECRET = process.env.JWT_SECRET || 'secretkey_kanban_123';

// Middleware xác thực token
const verifyToken = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ message: 'not found token' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ message: 'token is not valid or expired' });
    }
};

// Middleware kiểm tra vai trò Member
const checkRole = (allowedRoles = []) => {
    return async (req, res, next) => {
        try {
            // Lấy id người dùng từ req.user (được gán từ verifyToken)
            const userId = req.user.id || req.user._id;

            // Tìm thông tin member tương ứng với userId
            const member = await Member.findOne({ userId });

            if (!member) {
                return res.status(404).json({ message: 'Không tìm thấy thông tin thành viên!' });
            }

            // Kiểm tra role của member
            if (!allowedRoles.includes(member.role)) {
                return res.status(403).json({
                    message: 'Bạn không có quyền truy cập chức năng này!'
                });
            }

            // (Tùy chọn) Gán thông tin member vào req để các route sau sử dụng nếu cần
            req.member = member;

            next();
        } catch (error) {
            return res.status(500).json({ message: 'Lỗi máy chủ khi kiểm tra quyền!' });
        }
    };
};

module.exports = {
    verifyToken,
    checkRole
};
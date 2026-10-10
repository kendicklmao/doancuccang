const jwt = require('jsonwebtoken');
const User = require('../model/user'); // Import model User
const Member = require('../model/member');
const JWT_SECRET = process.env.JWT_SECRET || 'secretkey_kanban_123';

// Middleware xác thực token & trạng thái tài khoản
const verifyToken = async (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ message: 'not found token' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        // Tìm user trong Database để kiểm tra trạng thái mới nhất
        const user = await User.findById(decoded.id || decoded._id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Nếu người dùng bị Suspend (Inactive)
        if (user.status === 'Inactive') {
            return res.status(403).json({
                message: 'ACCOUNT_SUSPENDED',
                logout: true
            });
        }

        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ message: 'token is not valid or expired' });
    }
};

const checkRole = (allowedRoles = []) => {
    return async (req, res, next) => {
        try {
            // Lấy userId từ req.user (do verifyToken gán trước đó)
            const userId = req.user?.id || req.user?._id;

            if (!userId) {
                return res.status(401).json({ message: 'Không tìm thấy thông tin xác thực!' });
            }

            // 1. Kiểm tra role từ bảng User
            const user = await User.findById(userId);

            if (!user) {
                return res.status(404).json({ message: 'Không tìm thấy thông tin người dùng!' });
            }

            req.userFull = user; // Gán user vào req để dùng lại nếu cần

            // 2. Nếu là Admin -> Cấp mọi quyền, cho đi tiếp luôn
            if (user.role === 'Admin') {
                return next();
            }

            // 3. Nếu KHÔNG phải Admin mà truyền checkRole([]) -> Chặn ngay
            if (allowedRoles.length === 0) {
                return res.status(403).json({
                    message: 'Chức năng này chỉ dành cho tài khoản Admin!'
                });
            }

            // 4. Nếu KHÔNG phải Admin và có truyền allowedRoles -> Kiểm tra bảng Member
            const member = await Member.findOne({ userId });

            if (!member) {
                return res.status(404).json({ message: 'Không tìm thấy thông tin thành viên!' });
            }

            if (!allowedRoles.includes(member.role)) {
                return res.status(403).json({
                    message: 'Bạn không có quyền truy cập chức năng này!'
                });
            }

            req.member = member; // Gán member vào req để dùng lại nếu cần

            next();
        } catch (error) {
            console.error('CheckRole Error:', error);
            return res.status(500).json({ message: 'Lỗi máy chủ khi kiểm tra quyền!' });
        }
    };
};

module.exports = {
    verifyToken,
    checkRole
};
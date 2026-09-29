const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'secretkey_kanban_123';

// Middleware xác thực token (Giữ nguyên logic của bạn)
const verifyToken = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ message: 'not found token' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // Dữ liệu decoded cần chứa trường `role`
        next();
    } catch (err) {
        res.status(401).json({ message: 'token is not valid or expired' });
    }
};

// Middleware kiểm tra vai trò (Role-based Authorization)
const checkRole = (allowedRoles = []) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                message: 'Bạn không có quyền truy cập chức năng này!'
            });
        }
        next();
    };
};

module.exports = {
    verifyToken,
    checkRole
};
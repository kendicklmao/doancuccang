const jwt = require('jsonwebtoken');
const User = require('../model/user'); // Import model User
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

module.exports = {
    verifyToken
};
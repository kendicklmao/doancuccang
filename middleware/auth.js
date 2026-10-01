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


module.exports = {
    verifyToken
};
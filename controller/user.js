const User = require('./../model/user');
const Member = require('./../model/member');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Project = require('./../model/project');
const Column = require('./../model/column');
const Task = require('./../model/task');
const mongoose = require('mongoose');
const mailer = require('./../helper/mailer');
const passwordReset = require('./../helper/passwordReset');

const JWT_SECRET = process.env.JWT_SECRET || 'secretkey_kanban_123';

exports.register = async (req, res) => {
    try {
        const { username, email, password, role } = req.body;

        const cleanEmail = email.trim().toLowerCase();
        const cleanUsername = username.trim();

        const existingUser = await User.findOne({
            $or: [{ email: cleanEmail }, { username: cleanUsername }]
        });

        if (existingUser) {
            return res.status(400).json({ message: 'Email or username not available' });
        }

        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({
            username: cleanUsername,
            email: cleanEmail,
            password: hashedPassword,
            role: role || 'Member',
        });

        await newUser.save();

        res.status(201).json({ message: 'register success' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};


exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'email or password not available' });
        }
        if (user.status === "Inactive") {
            return res.status(403).json({ message: "Account banned" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'email or password not available' });
        }
           
        const token = jwt.sign(
            { id: user._id, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            message: 'login success',
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                avatar: user.avatar,
                role: user.role
            }
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.GetCurrentUser = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        const memberInfor = await Member.findOne({ userId: user._id });

        return res.status(200).json({
            user, // Trả về đầy đủ thông tin user bao gồm cả `point`
            userRole: user.role,
            memberRole: memberInfor ? memberInfor.role : null
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getUsers = async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.json(users);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getUserById = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'not found' });
        }
        res.json(user);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.updateUser = async (req, res) => {
    try {
        const { username, email, password, role, status } = req.body;
        const userId = req.params.id;

        const currentUser = await User.findById(userId);
        if (!currentUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        const updateData = {};
        let hasAnyChange = false;

        if (username !== undefined && username !== null) {
            const cleanUsername = username.toString().trim();
            if (cleanUsername !== currentUser.username) {
                const existingUser = await User.findOne({ username: cleanUsername, _id: { $ne: userId } });
                if (existingUser) {
                    return res.status(400).json({ message: 'Username already taken' });
                }
                updateData.username = cleanUsername;
                hasAnyChange = true;
            }
        }

        // XỬ LÝ STATUS AN TOÀN
        if (status !== undefined && status !== null) {
            const cleanStatus = status.toString().trim();
            if (cleanStatus !== currentUser.status) {
                updateData.status = cleanStatus;
                hasAnyChange = true;
            }
        }

        if (role !== undefined && role !== null) {
            const cleanRole = role.toString().trim();
            if (cleanRole !== currentUser.role) {
                const allowedRoles = ["Member", "Admin", "Leader"];
                if (!allowedRoles.includes(cleanRole)) {
                    return res.status(400).json({ message: "Invalid role" });
                }
                updateData.role = cleanRole;
                hasAnyChange = true;
            }
        }

        if (email !== undefined && email !== null) {
            const cleanEmail = email.toString().trim().toLowerCase();
            if (cleanEmail !== currentUser.email) {
                const existingEmail = await User.findOne({ email: cleanEmail, _id: { $ne: userId } });
                if (existingEmail) {
                    return res.status(400).json({ message: 'Email already in use' });
                }
                updateData.email = cleanEmail;
                hasAnyChange = true;
            }
        }

        if (password) {
            const isSamePassword = await bcrypt.compare(password, currentUser.password);
            if (!isSamePassword) {
                const salt = await bcrypt.genSalt(10);
                updateData.password = await bcrypt.hash(password, salt);
                hasAnyChange = true;
            }
        }

        if (!hasAnyChange) {
            return res.status(400).json({ message: 'No changes detected' });
        }

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            updateData,
            { new: true, runValidators: true }
        ).select('-password');

        // BẮN SỰ KIỆN SOCKET AN TOÀN KHI BAN USER
        if (updatedUser.status === "Inactive") {
            try {
                const io = req.app.get('io');
                if (io) {
                    io.emit("user_banned", { userId: updatedUser._id.toString() });
                }
            } catch (socketErr) {
                console.error("Lỗi khi bắn Socket ban user:", socketErr.message);
            }
        }

        res.json({ message: 'User updated successfully', user: updatedUser });
    } catch (err) {
        console.error("Lỗi tại updateUser:", err);
        res.status(500).json({ error: err.message });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const targetUserId = req.params.id;
        const currentUserId = req.user.id;

        if (targetUserId !== currentUserId) {
            return res.status(403).json({ message: 'Access denied. You can only delete your own account.' });
        }

        const user = await User.findById(targetUserId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const userProjects = await Project.find({ userId: targetUserId }).select('_id');
        const projectIds = userProjects.map(project => project._id);

        if (projectIds.length > 0) {
            const projectColumns = await Column.find({ projectId: { $in: projectIds } }).select('_id');
            const columnIds = projectColumns.map(column => column._id);

            if (columnIds.length > 0) {
                await Task.deleteMany({ columnId: { $in: columnIds } });

                await Column.deleteMany({ projectId: { $in: projectIds } });
            }

            await Project.deleteMany({ userId: targetUserId });
        }

        await User.findByIdAndDelete(targetUserId);

        res.json({ message: 'User and all associated projects, columns, and tasks deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.CheckEmail =async (req,res) =>{
    try {
        const {email}= req.body;
        if(!email){
            return res.status(400).json({ message: 'Please enter your email address' });
        }
        const user = await User.findOne({email :email});
        if(!user){
            return res.status(404).json({ message: 'Email address not found in the system' });
        }
        return res.status(200).json({
            message:'Email verifield successfully',
            userId :user._id
        })
    } catch (error) {
         console.error("Lỗi forgotPassword:", err);
        return res.status(500).json({ error: err.message });
    }
}
// The former POST /user/reset-password changed ANY account's password from just an email (no proof of ownership).
// It is retired in favour of the OTP flow below.
exports.resetPassword = (req, res) =>
    res.status(410).json({ message: 'This endpoint was removed. Use POST /api/user/forgot-password/request and /verify.' });

const passwordDeps = () => ({
    User,
    PasswordReset: require('./../model/passwordReset'),
    sendMail: mailer.sendMail,
    isMailConfigured: mailer.isMailConfigured,
    secret: process.env.OTP_SECRET || JWT_SECRET,
});

// POST /api/user/forgot-password/request { email } (public)
exports.requestPasswordOtp = async (req, res) => {
    try {
        const result = await passwordReset.requestOtp(req.body || {}, passwordDeps());
        return res.status(result.status).json(result.body);
    } catch (err) {
        console.error('requestPasswordOtp failed:', err.message); // never log the code or the email body
        return res.status(502).json({ message: 'The verification email could not be sent. Please try again later.' });
    }
};

// POST /api/user/forgot-password/verify { email, otp, newPassword } (public)
exports.verifyPasswordOtp = async (req, res) => {
    try {
        const result = await passwordReset.verifyOtpAndReset(req.body || {}, passwordDeps());
        return res.status(result.status).json(result.body);
    } catch (err) {
        console.error('verifyPasswordOtp failed:', err.message);
        return res.status(500).json({ message: 'Server error' });
    }
};

// POST /api/user/change-password { currentPassword, newPassword } [JWT]
exports.changePassword = async (req, res) => {
    try {
        const result = await passwordReset.changePassword(
            { userId: req.user?.id || req.user?._id, currentPassword: req.body?.currentPassword, newPassword: req.body?.newPassword },
            { User }
        );
        return res.status(result.status).json(result.body);
    } catch (err) {
        console.error('changePassword failed:', err.message);
        return res.status(500).json({ message: 'Server error' });
    }
};
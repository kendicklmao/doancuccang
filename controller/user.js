const User = require('./../model/user');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Project = require('./../model/project');
const Column = require('./../model/column');
const Task = require('./../model/task');

const JWT_SECRET = process.env.JWT_SECRET || 'secretkey_kanban_123';

exports.register = async (req, res) => {
    try {
        const { username, email, password , role} = req.body;

        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.status(400).json({ message: 'email not available' });
        }

        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({
            username,
            email,
            password: hashedPassword,
            role: role,
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
        const { username, email, password } = req.body;
        const userId = req.params.id;

        const currentUser = await User.findById(userId);
        if (!currentUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        const updateData = {};
        let hasAnyChange = false;

        if (username !== undefined) {
            const cleanUsername = username.trim();
            if (cleanUsername !== currentUser.username) {
                const existingUser = await User.findOne({ username: cleanUsername, _id: { $ne: userId } });
                if (existingUser) {
                    return res.status(400).json({ message: 'Username already taken' });
                }
                updateData.username = cleanUsername;
                hasAnyChange = true;
            }
        }

        if (email !== undefined) {
            const cleanEmail = email.trim().toLowerCase();
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

        res.json({ message: 'User updated successfully', user: updatedUser });
    } catch (err) {
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
const User = require('./../model/user');
const Project = require('./../model/project');
const Column = require('./../model/column');
const Task = require('./../model/task');
const Comment = require('./../model/comment');
const TaskActivity = require('./../model/activity');
const Member = require('./../model/member');
const Note = require('./../model/note');

exports.getProject = async (req, res) => {
    try {
        const projects = await Project.find()
            .populate({
                path: 'assignees',
                populate: {
                    path: 'userId',
                    select: 'username email avatar'
                }
            })
            .sort({ createdAt: -1 });

        res.status(200).json(projects);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createProject = async (req, res) => {
    try {
        const { name, description, color, startDate, date, assignees } = req.body;
        const userId = req.user.id;

        if (!name || !name.trim()) {
            return res.status(400).json({ message: 'Project name is required' });
        }

        // Lọc an toàn cho assignees ở phía Server
        const safeAssignees = Array.isArray(assignees)
            ? assignees.filter(id => id && typeof id === 'string' && id.trim() !== '')
            : [];

        const newProject = new Project({
            name: name.trim(),
            description,
            color,
            startDate: startDate || new Date(),
            date,
            userId,
            assignees: safeAssignees
        });
        await newProject.save();

        const defaultColumns = [
            { title: 'Todo', position: 0, projectId: newProject._id },
            { title: 'In Progress', position: 1, projectId: newProject._id },
            { title: 'Review', position: 2, projectId: newProject._id },
            { title: 'Done', position: 3, projectId: newProject._id }
        ];

        const createdColumns = await Column.insertMany(defaultColumns);

        res.status(201).json({
            message: 'Project created successfully with default columns',
            project: newProject,
            columns: createdColumns
        });
    } catch (err) {
        console.error("Lỗi Server Create Project:", err);
        res.status(500).json({ error: err.message });
    }
};

exports.deleteProject = async (req, res) => {
    try {
        const projectId = req.params.id;

        // 1. Kiểm tra sự tồn tại của Project trước
        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        // 2. Tìm tất cả Column IDs thuộc Project
        const columns = await Column.find({ projectId }).select('_id');
        const columnIds = columns.map(col => col._id);

        // 3. Tìm tất cả Task IDs thuộc Project hoặc các Columns của Project
        const tasks = await Task.find({
            $or: [
                { projectId: projectId },
                { columnId: { $in: columnIds } }
            ]
        }).select('_id');
        const taskIds = tasks.map(t => t._id);

        // 4. Xóa đồng thời (Parallel) tất cả dữ liệu liên quan
        const deletePromises = [
            Column.deleteMany({ projectId }),
            Task.deleteMany({
                $or: [
                    { projectId: projectId },
                    { columnId: { $in: columnIds } }
                ]
            }),
            // Xóa tất cả Member thuộc Project
            Member.deleteMany({ projectId }),
            // 🟢 Xóa tất cả Note thuộc Project
            Note.deleteMany({ projectId }),
            Project.findByIdAndDelete(projectId)
        ];

        // Nếu có Task, thêm nhiệm vụ xóa Comment và TaskActivity
        if (taskIds.length > 0) {
            deletePromises.push(
                Comment.deleteMany({ taskId: { $in: taskIds } }),
                TaskActivity.deleteMany({ taskId: { $in: taskIds } })
            );
        }

        // Thực thi toàn bộ lệnh xóa cùng lúc
        await Promise.all(deletePromises);

        return res.json({
            message: 'Project and all associated members, columns, tasks, notes, comments & activities deleted successfully'
        });

    } catch (err) {
        console.error('Delete Project Error:', err);
        return res.status(500).json({ error: err.message });
    }
};

// HÀM UPDATE PROJECT ĐÃ ĐƯỢC SỬA ĐỔI
exports.updateProject = async (req, res) => {
    try {
        const { name, description, color, startDate, date, dueDate, assignees } = req.body;
        const projectId = req.params.id;

        // 1. Kiểm tra project có tồn tại không
        const currentProject = await Project.findById(projectId);
        if (!currentProject) {
            return res.status(404).json({ message: 'Project not found' });
        }

        const updateData = {};
        let hasAnyChange = false;

        // Cập nhật Name
        if (name !== undefined) {
            const cleanName = name.trim();
            if (cleanName && cleanName !== currentProject.name) {
                updateData.name = cleanName;
                hasAnyChange = true;
            }
        }

        // Cập nhật Description
        if (description !== undefined && description !== currentProject.description) {
            updateData.description = description;
            hasAnyChange = true;
        }

        // Cập nhật Color
        if (color !== undefined && color !== currentProject.color) {
            updateData.color = color;
            hasAnyChange = true;
        }

        // Cập nhật startDate
        if (startDate !== undefined && startDate !== null) {
            const newStartDate = new Date(startDate).getTime();
            const currentStartDate = currentProject.startDate ? new Date(currentProject.startDate).getTime() : 0;

            if (!isNaN(newStartDate) && newStartDate !== currentStartDate) {
                updateData.startDate = startDate;
                hasAnyChange = true;
            }
        }

        // Cập nhật Date / DueDate
        const targetDate = date || dueDate;
        if (targetDate !== undefined && targetDate !== null) {
            const newDate = new Date(targetDate).getTime();
            const currentDate = currentProject.date ? new Date(currentProject.date).getTime() : 0;

            if (!isNaN(newDate) && newDate !== currentDate) {
                updateData.date = targetDate;
                hasAnyChange = true;
            }
        }

        // Cập nhật Assignees
        if (assignees !== undefined && Array.isArray(assignees)) {
            const currentAssigneeIds = (currentProject.assignees || []).map(id => String(id));
            const newAssigneeIds = assignees.map(id => String(id));

            const isDifferentLength = currentAssigneeIds.length !== newAssigneeIds.length;
            const hasNewMember = newAssigneeIds.some(id => !currentAssigneeIds.includes(id));

            if (isDifferentLength || hasNewMember) {
                updateData.assignees = newAssigneeIds;
                hasAnyChange = true;
            }
        }

        // Nếu không gửi bất kỳ dữ liệu nào thay đổi
        if (!hasAnyChange) {
            return res.status(400).json({ message: 'No changes detected' });
        }

        // 3. Tiến hành lưu thay đổi vào DB
        const updatedProject = await Project.findByIdAndUpdate(
            projectId,
            updateData,
            { new: true, runValidators: true }
        ).populate({
            path: 'assignees',
            select: 'username email role'
        });

        return res.json({
            message: 'Project updated successfully',
            project: updatedProject
        });

    } catch (err) {
        console.error("Lỗi updateProject:", err);
        return res.status(500).json({ error: err.message });
    }
};

exports.getProjectById = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id)
            .populate({
                path: 'assignees',
                populate: {
                    path: 'userId',
                    select: 'username email avatar'
                }
            });

        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        res.status(200).json(project);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.addProjectAssignee = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { memberUserId } = req.body;
        const currentUserId = req.user.id;

        const project = await Project.findOne({ _id: projectId, userId: currentUserId });
        if (!project) {
            return res.status(403).json({ message: 'Unauthorized or Project not found' });
        }

        await Project.findByIdAndUpdate(projectId, {
            $addToSet: { assignees: memberUserId }
        });

        res.json({ message: 'Member added to project successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getProjectAssignees = async (req, res) => {
    try {
        const { id } = req.params;
        const currentUserId = req.user.id;

        const project = await Project.findById(id)
            .populate('userId', '_id username email avatar')
            .populate('assignees', '_id username email avatar');

        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        const isOwner = project.userId._id.toString() === currentUserId;
        const isMember = project.assignees.some(member => member._id.toString() === currentUserId);

        if (!isOwner && !isMember) {
            return res.status(403).json({ message: 'Unauthorized to view this project members' });
        }

        const memberMap = new Map();

        if (project.userId) {
            memberMap.set(project.userId._id.toString(), {
                _id: project.userId._id,
                username: project.userId.username,
                email: project.userId.email,
                avatar: project.userId.avatar,
                roleInProject: 'Owner'
            });
        }

        project.assignees.forEach(member => {
            if (!memberMap.has(member._id.toString())) {
                memberMap.set(member._id.toString(), {
                    _id: member._id,
                    username: member.username,
                    email: member.email,
                    avatar: member.avatar,
                    roleInProject: 'Member'
                });
            }
        });

        const membersList = Array.from(memberMap.values());

        res.json({
            success: true,
            total: membersList.length,
            assignees: membersList
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.removeProjectAssignee = async (req, res) => {
    try {
        const { id: projectId, memberUserId } = req.params;
        const currentUserId = req.user.id;

        const project = await Project.findOne({ _id: projectId, userId: currentUserId });
        if (!project) {
            return res.status(403).json({ message: 'Unauthorized or Project not found' });
        }

        if (memberUserId === currentUserId) {
            return res.status(400).json({ message: 'Cannot remove the project owner' });
        }

        const updatedProject = await Project.findByIdAndUpdate(
            projectId,
            { $pull: { assignees: memberUserId } },
            { new: true }
        );

        const columns = await Column.find({ projectId }).select('_id');
        const columnIds = columns.map(col => col._id);

        if (columnIds.length > 0) {
            await Task.updateMany(
                { columnId: { $in: columnIds } },
                { $pull: { assignees: memberUserId } }
            );
        }

        res.json({
            message: 'Member removed from project and associated tasks successfully',
            project: updatedProject
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// 1. Cập nhật projectDetail (Mô tả chi tiết dự án)
exports.updateProjectDetail = async (req, res) => {
    try {
        const { id } = req.params;
        const { projectDetail } = req.body;

        const updatedProject = await Project.findByIdAndUpdate(
            id,
            { projectDetail: projectDetail || '' },
            { new: true, runValidators: true }
        );

        if (!updatedProject) {
            return res.status(404).json({ message: 'Project not found' });
        }

        return res.status(200).json({
            message: 'Project detail updated successfully',
            project: updatedProject
        });
    } catch (err) {
        console.error("Lỗi updateProjectDetail:", err);
        return res.status(500).json({ error: err.message });
    }
};

// 2. Upload File tài liệu từ máy tính
// controller/project.js - Tại hàm uploadProjectDocument

exports.uploadProjectDocument = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Vui lòng chọn file để tải lên' });
        }

        // Fix lỗi font tiếng Việt: Chuyển mã hóa latin1 sang UTF-8
        const correctedFileName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');

        const projectId = req.params.id;

        const newDocument = {
            name: correctedFileName, // Sử dụng tên file đã fix lỗi font
            url: `/uploads/${req.file.filename}`,
            uploadedBy: req.user.id || req.user._id,
            createdAt: new Date()
        };

        const project = await Project.findByIdAndUpdate(
            projectId,
            { $push: { documents: newDocument } },
            { new: true }
        ).populate('documents.uploadedBy', 'username email');

        return res.status(200).json({
            message: 'Tải tài liệu lên thành công',
            documents: project.documents
        });

    } catch (error) {
        console.error('Lỗi upload file:', error);
        return res.status(500).json({ message: 'Lỗi máy chủ khi tải file lên' });
    }
};

// 3. Xóa Document khỏi Project
exports.removeProjectDocument = async (req, res) => {
    try {
        const { id, documentId } = req.params;

        const updatedProject = await Project.findByIdAndUpdate(
            id,
            { $pull: { documents: { _id: documentId } } },
            { new: true }
        ).populate({
            path: 'documents.uploadedBy',
            select: 'username email avatar'
        });

        if (!updatedProject) {
            return res.status(404).json({ message: 'Project not found' });
        }

        return res.status(200).json({
            message: 'Document removed successfully',
            documents: updatedProject.documents
        });
    } catch (err) {
        console.error("Lỗi removeProjectDocument:", err);
        return res.status(500).json({ error: err.message });
    }
};

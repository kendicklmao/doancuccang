const User = require('./../model/user');
const Project = require('./../model/project');
const Column = require('./../model/column');
const Task = require('./../model/task');

exports.getProject = async (req, res) => {
    try{
        const projects = await Project.find();
        res.json(projects);
    }
    catch(err){
        res.status(500).json({message: err.message});
    }
}

exports.createProject = async (req, res) => {
    try {
        const { name, description, color, date, assignees } = req.body;
        const userId = req.user.id;

        if (!name || !name.trim()) {
            return res.status(400).json({ message: 'Project name is required' });
        }

        const newProject = new Project({
            name: name.trim(),
            description,
            color,
            date,
            userId,
            assignees
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
        res.status(500).json({ error: err.message });
    }
};

exports.deleteProject = async (req, res) => {
    try {
        const projectId = req.params.id;
        const currentUserId = req.user.id;

        const project = await Project.findOne({ _id: projectId, userId: currentUserId });
        if (!project) {
            return res.status(404).json({ message: 'Project not found or unauthorized' });
        }

        const columns = await Column.find({ projectId }).select('_id');
        const columnIds = columns.map(col => col._id);

        if (columnIds.length > 0) {
            await Task.deleteMany({ columnId: { $in: columnIds } });

            await Column.deleteMany({ projectId });
        }

        await Project.findByIdAndDelete(projectId);

        res.json({ message: 'Project and all associated columns & tasks deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.updateProject = async (req, res) => {
    try {
        const { name, description, color, date } = req.body;
        const projectId = req.params.id;
        const userId = req.user.id;

        const currentProject = await Project.findOne({ _id: projectId, userId });
        if (!currentProject) {
            return res.status(404).json({ message: 'Project not found or unauthorized' });
        }

        const updateData = {};
        let hasAnyChange = false;

        if (name !== undefined) {
            const cleanName = name.trim();
            if (cleanName && cleanName !== currentProject.name) {
                updateData.name = cleanName;
                hasAnyChange = true;
            }
        }

        if (description !== undefined && description !== currentProject.description) {
            updateData.description = description;
            hasAnyChange = true;
        }

        if (color !== undefined && color !== currentProject.color) {
            updateData.color = color;
            hasAnyChange = true;
        }

        if (date !== undefined) {
            const newDate = new Date(date).getTime();
            const currentDate = new Date(currentProject.date).getTime();

            if (!isNaN(newDate) && newDate !== currentDate) {
                updateData.date = date;
                hasAnyChange = true;
            }
        }

        if (!hasAnyChange) {
            return res.status(400).json({ message: 'No changes detected' });
        }

        const updatedProject = await Project.findByIdAndUpdate(
            projectId,
            updateData,
            { new: true, runValidators: true }
        );

        res.json({ message: 'Project updated successfully', project: updatedProject });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getProjectById = async (req, res) => {
    try{
        const {id} = req.params;
        const project = await Project.findById(id);
        if (!project) {
            return res.status(404).json({ message: 'not found' });
        }

        return res.status(200).json({ success: true, data: project });
    }
    catch(err){
        res.status(500).json({message: err.message});
    }
}

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
        const { id } = req.params; // projectId
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


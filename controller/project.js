const Project = require('./../model/project');
const Column = require('./../model/Column');

exports.getProject = async (req, res) => {
    try{
        const projects = await Project.find()
        res.json(projects);
    }
    catch(err){
        res.status(500).json({message: err.message});
    }
}

exports.createProject = async (req, res) => {
    try {
        const { name, description, color, date } = req.body;
        const userId = req.user.id;

        if (!name || !name.trim()) {
            return res.status(400).json({ message: 'Project name is required' });
        }

        const newProject = new Project({
            name: name.trim(),
            description,
            color,
            date,
            userId
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
        await Project.findByIdAndDelete(req.params.id);
        res.json({ message: 'deleted' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
}

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


const Project = require('./../model/project');

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
    try{
        const newProject = new Project(req.body);
        await newProject.save;
        res.status(201).json(newProject);
    }
    catch(err){
        res.status(400).json({message: err.message});
    }
}

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
        const {id} = req.params;
        const {name, description, date, color, userId} = req.body;
        const updatedProject = await Project.findByIdAndUpdate(
            id,
            { name, description, date, color, userId },
            { new: true, runValidators: true }
        );

        if (!updatedProject) {
            return res.status(404).json({ message: 'not found' });
        }

        return res.status(200).json({
            success: true,
            message: 'update project successfully',
            data: updatedProject
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
}

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


const express = require('express');
const taskRouter = express.Router();
const controller = require('./../controller/task');
const auth = require('../middleware/auth');

taskRouter.post('/', auth, controller.createTask);

taskRouter.get('/', auth, controller.getTask);

taskRouter.delete('/:id', auth, controller.deleteTask);

taskRouter.put('/:id', auth, controller.updateTask);

taskRouter.get('/:id', auth, controller.getTaskById);

taskRouter.put('/:id/move', auth, controller.moveTask);

taskRouter.get('/project/:id', auth, controller.getTasksByProject);

module.exports = taskRouter;
const express = require('express');
const taskRouter = express.Router();
const controller = require('./../controller/task');

taskRouter.post('/', controller.createTask);

taskRouter.get('/', controller.getTask);

taskRouter.delete('/:id', controller.deleteTask);

taskRouter.put('/:id', controller.updateTask);

taskRouter.get('/:id', controller.getTaskById);

taskRouter.put('/:id/move', controller.moveTask);

module.exports = taskRouter;
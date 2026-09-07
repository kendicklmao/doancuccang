const express = require('express');
const taskRouter = express.Router();
const controller = require('./../controller/task');

taskRouter.post('/', controller.createTask);

taskRouter.get('/', controller.getTask);

taskRouter.delete('/:id', controller.deleteTask);

module.exports = taskRouter;
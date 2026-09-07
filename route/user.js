const express = require('express');
const userRouter = express.Router();
const controller = require('./../controller/user');
const auth = require('../middleware/auth');

userRouter.post('/register', controller.register);

userRouter.post('/login', controller.login);

userRouter.get('/', auth, controller.getUsers);

userRouter.delete('/:id', auth, controller.deleteUser);

userRouter.put('/:id', auth, controller.updateUser);

userRouter.get('/:id', auth, controller.getUserById);

module.exports = userRouter;
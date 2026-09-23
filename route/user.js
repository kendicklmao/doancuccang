const express = require('express');
const userRouter = express.Router();
const controller = require('./../controller/user');
const auth = require('../middleware/auth');

userRouter.post('/register', controller.register);

userRouter.post('/login', controller.login);

userRouter.get('/currentUser',auth,controller.GetCurrentUser);

userRouter.get('/GetUsers', controller.getUsers);
userRouter.get('/', controller.getUsers);
userRouter.delete('/:id', auth, controller.deleteUser);

userRouter.get('/:id', auth, controller.getUserById);

module.exports = userRouter;
const express = require('express');
const userRouter = express.Router();
const controller = require('./../controller/user');
const auth = require('../middleware/auth');

userRouter.post('/user/register', controller.register);

userRouter.post('/user/login', controller.login);

userRouter.get('/user', auth, controller.getUsers);

userRouter.delete('/user/:id', auth, controller.deleteUser);

userRouter.put('/user/:id', auth, controller.updateUser);

userRouter.get('/user/:id', auth, controller.getUserById);
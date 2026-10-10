const express = require('express');
const noteRouter = express.Router();
const noteController = require('../controller/note');
const { verifyToken, checkRole } = require('../middleware/auth');

// Lấy danh sách note theo Project
noteRouter.get('/project/:projectId', verifyToken, noteController.getNotesByProjectId);

// Tạo note mới
noteRouter.post('/', verifyToken, checkRole(["Manager", "Leader"]),noteController.createNote);

// Xóa note
noteRouter.delete('/:id', verifyToken, checkRole(["Manager", "Leader"]),noteController.deleteNote);

module.exports = noteRouter;
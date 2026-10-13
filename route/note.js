const express = require('express');
const noteRouter = express.Router();
const noteController = require('../controller/note');
const { verifyToken, checkRole } = require('../middleware/auth');
const { emitOnSuccess, str } = require('../middleware/realtime');

// Lấy danh sách note theo Project
noteRouter.get('/project/:projectId', verifyToken, noteController.getNotesByProjectId);

// Tạo note mới
noteRouter.post('/', verifyToken, checkRole(["Manager", "Leader"]), emitOnSuccess("note_created", (req) => ({ projectId: str(req.body?.projectId) })),noteController.createNote);

// Xóa note
noteRouter.delete('/:id', verifyToken, checkRole(["Manager", "Leader"]), emitOnSuccess("note_deleted", (req) => ({ noteId: str(req.params.id) })),noteController.deleteNote);

module.exports = noteRouter;
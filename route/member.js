const express = require('express');
const memberRouter = express.Router();
const memberController = require('./../controller/member');
const { verifyToken, checkRole } = require('../middleware/auth');

memberRouter.get('/', verifyToken, memberController.getMembers);
memberRouter.get('/project/:id', verifyToken, memberController.getMembersByProject);
memberRouter.post('/invite',  verifyToken, checkRole(["Manager"]),memberController.inviteMember);
memberRouter.put('/:id', verifyToken, checkRole(["Manager"]),memberController.updateMember);
memberRouter.delete('/:id/project/:id', verifyToken, checkRole(["Manager"]),memberController.deleteMember);
memberRouter.get('/project/:id/weekly-points', verifyToken, memberController.getMembersWithWeeklyPoints);

module.exports = memberRouter;
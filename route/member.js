const express = require('express');
const memberRouter = express.Router();
const memberController = require('./../controller/member');
const { verifyToken, checkRole } = require('../middleware/auth');

memberRouter.get('/', verifyToken, memberController.getMembers);
memberRouter.get('/project/:id', verifyToken, memberController.getMembersByProject);
memberRouter.post('/invite',  verifyToken, memberController.inviteMember);
memberRouter.put('/:id', verifyToken, memberController.updateMember);
memberRouter.delete('/:id/project/:id', verifyToken, memberController.deleteMember);
memberRouter.get('/project/:id/weekly-points', verifyToken, memberController.getMembersWithWeeklyPoints);

module.exports = memberRouter;
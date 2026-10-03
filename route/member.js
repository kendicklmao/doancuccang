const express = require('express');
const memberRouter = express.Router();
const memberController = require('./../controller/member');
const { verifyToken, checkRole } = require('../middleware/auth');

memberRouter.get('/', memberController.getMembers);
memberRouter.get('/project/:id', memberController.getMembersByProject);
memberRouter.post('/invite',  memberController.inviteMember);
memberRouter.put('/:id', memberController.updateMember);
memberRouter.delete('/:id/project/:id', verifyToken, memberController.deleteMember);
memberRouter.get('/project/:id/weekly-points', verifyToken, memberController.getMembersWithWeeklyPoints);

module.exports = memberRouter;
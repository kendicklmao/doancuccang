const express = require('express');
const memberRouter = express.Router();
const memberController = require('./../controller/member');
const { verifyToken, checkRole } = require('../middleware/auth');
const { emitOnSuccess, str } = require('../middleware/realtime');

memberRouter.get('/', verifyToken, memberController.getMembers);
memberRouter.get('/project/:id', verifyToken, memberController.getMembersByProject);
memberRouter.post('/invite',  verifyToken, checkRole(["Manager"]), emitOnSuccess("member_added", (req) => ({ projectId: str(req.body?.projectId) })),memberController.inviteMember);
memberRouter.put('/:id', verifyToken, checkRole(["Manager"]), emitOnSuccess("member_updated", (req) => ({ memberId: str(req.params.id) })),memberController.updateMember);
memberRouter.delete('/:id/project/:id', verifyToken, checkRole(["Manager"]), emitOnSuccess("member_removed", () => ({})),memberController.deleteMember);
memberRouter.get('/project/:id/weekly-points', verifyToken, memberController.getMembersWithWeeklyPoints);

module.exports = memberRouter;
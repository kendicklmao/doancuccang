const express = require('express');
const memberRouter = express.Router();
const memberController = require('./../controller/member');
const { verifyToken, checkRole } = require('../middleware/auth');

memberRouter.get('/', verifyToken, memberController.getMembers);
memberRouter.get('/:id', verifyToken, memberController.getMemberById);
memberRouter.post('/invite', verifyToken, checkRole(["Manager"]),  memberController.inviteMember);
memberRouter.put('/:id', verifyToken, checkRole(["Manager"]), memberController.updateMember);
memberRouter.delete('/:id', verifyToken, checkRole(["Manager"]), memberController.deleteMember);

module.exports = memberRouter;
const express = require('express');
const memberRouter = express.Router();
const memberController = require('./../controller/member');
const { verifyToken, checkRole } = require('../middleware/auth');

memberRouter.get('/', memberController.getMembers);
memberRouter.get('/:id', memberController.getMemberById);
memberRouter.post('/invite',  memberController.inviteMember);
memberRouter.put('/:id', memberController.updateMember);
memberRouter.delete('/:id', verifyToken, memberController.deleteMember);

module.exports = memberRouter;
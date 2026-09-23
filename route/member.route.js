const express = require("express");
const memberRouter = express.Router();
const controller = require("./../controller/member.controller");

memberRouter.post("/invite",controller.InviteMember);


module.exports =memberRouter;
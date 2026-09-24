const express = require("express");
const memberRouter = express.Router();
const controller = require("./../controller/member.controller");

memberRouter.post("/invite",controller.InviteMember);

memberRouter.get("/getAll",controller.GetAllMember);

module.exports =memberRouter;
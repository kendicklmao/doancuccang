const express = require("express");
const projectRouter = express.Router();
const controller = require("./../controller/project");
const auth = require('../middleware/auth');

projectRouter.post("/",auth, controller.createProject);

projectRouter.get("/", auth, controller.getProject);

projectRouter.get("/:id", auth, controller.getProjectById);

projectRouter.delete("/:id",auth, controller.deleteProject);

projectRouter.put("/:id",auth, controller.updateProject);

projectRouter.get("/:id/assignees", auth, controller.getProjectAssignees);

projectRouter.delete("/:id/assignees/:memberUserId", auth, controller.removeProjectAssignee);

module.exports = projectRouter;
const express = require("express");
const projectRouter = express.Router();
const controller = require("./../controller/project");

projectRouter.post("/",controller.createProject);

projectRouter.get("/", controller.getProject);

projectRouter.get("/:id", controller.getProjectById);

projectRouter.delete("/:id", controller.deleteProject);

projectRouter.put("/:id", controller.updateProject);

module.exports = projectRouter;
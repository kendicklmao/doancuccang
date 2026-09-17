const express = require("express");
const columnRouter = express.Router();
const controller = require("./../controller/column");
const auth = require('../middleware/auth');

columnRouter.post("/",auth, controller.createColumn);

columnRouter.get("/", auth, controller.getColumn);

columnRouter.get("/:id", auth, controller.getColumnById);

columnRouter.get("/project/:projectId", auth, controller.getColumnsByProject);

module.exports = columnRouter;
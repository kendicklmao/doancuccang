const express = require("express");
const columnRouter = express.Router();
const controller = require("./../controller/column");

columnRouter.post("/",controller.createColumn);

columnRouter.get("/", controller.getColumn);

module.exports = columnRouter;
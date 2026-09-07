const express = require("express");
const router = express.Router();

const taskRouter = require("./task");
const columnRouter = require("./column");
const projectRouter = require("./project");

router.use("/task", taskRouter);
router.use("/column", columnRouter)
router.use("/project", projectRouter);

module.exports = router;
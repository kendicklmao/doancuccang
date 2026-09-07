const express = require("express");
const router = express.Router();

const taskRouter = require("./task");
const columnRouter = require("./column");
const projectRouter = require("./project");
const userRouter = require("./user");

router.use("/task", taskRouter);
router.use("/column", columnRouter)
router.use("/project", projectRouter);
router.use("/user", userRouter);

module.exports = router;
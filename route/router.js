const express = require("express");
const router = express.Router();

const taskRouter = require("./task");
const columnRouter = require("./column");
const projectRouter = require("./project");
const userRouter = require("./user");
const memberRouter = require("./member.route");

router.use("/task", taskRouter);
router.use("/column", columnRouter);
router.use("/project", projectRouter);
router.use("/user", userRouter);
router.use("/member",memberRouter);
module.exports = router;
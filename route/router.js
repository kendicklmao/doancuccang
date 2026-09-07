const express = require("express");
const router = express.Router();

const taskRouter = require("./task");
const columnRouter = require("./column")

router.use("/task", taskRouter);
router.use("/column", columnRouter)

module.exports = router;
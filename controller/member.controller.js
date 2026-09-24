const User = require('./../model/user');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Project = require('./../model/project');
const Column = require('./../model/column');
const Task = require('./../model/task');
const Member = require('../model/Members.model');


exports.InviteMember = async(req, res)=>{
     const { email, role, position } = req.body;
      console.log("req.body:", req.body);
 try {
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "Email does not exist" });
    }


    const member = await Member.create({
      userId: user._id,
      role,
      position       
     
    });

    res.json({ message: "Adđ member successfully", member });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
exports.GetAllMember = async(req,res)=>{

 try {
     const data = await Member.find().populate("userId", "username email");
    res.json(data);
 } catch (error) {
    res.status(500).json({ error: err.message });
 }
}
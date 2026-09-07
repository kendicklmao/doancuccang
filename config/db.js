const mongoose = require("mongoose");
const config = require("./env");
const connectDB = async ()=>{
    const stringconnection = config.mongoUrl;
    await mongoose.connect(stringconnection);
    console.log("Connected DB.");
}
module.exports = connectDB;
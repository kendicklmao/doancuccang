const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const app = require("./app");
const config = require("./config/env");
const connectDB = require("./config/db");
const cloudinary = require("cloudinary").v2;
cloudinary.config({
    cloud_name: config.cloudinary_cloud_name,
    api_key: config.cloudinary_api_key,
    api_secret: config.cloudinary_api_secret
});
const startServer = async ()=>{
    try {
        await connectDB();
        app.listen(config.port, ()=>{
            console.log("Server is running on port "+config.port);
        })
    } catch (error) {
        console.log(error.message);
        process.exit(1);
    }
}
startServer();



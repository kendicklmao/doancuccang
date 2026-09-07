const app = require("./app");
const config = require("./config/env");
const connectDB = require("./config/db");

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


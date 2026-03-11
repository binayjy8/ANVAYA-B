const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);
const mongoose = require("mongoose");
require("dotenv").config();

const mongouri = process.env.MONGODB;

const initializeDatabase = async () => {
    await mongoose.connect(mongouri)
        .then(() => {
            console.log("Connected to DB");
        })
        .catch((error) => {
            console.log("Error connecting to database:", error);
        });
};

module.exports = { initializeDatabase };
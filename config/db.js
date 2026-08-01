const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);
const mongoose = require("mongoose");
require("dotenv").config();

const mongouri = process.env.MONGODB;

let connectionPromise = null;

function initializeDatabase() {
  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(mongouri, {
        serverSelectionTimeoutMS: 10000,
      })
      .then(() => {
        console.log("Connected to DB");
        return mongoose.connection;
      })
      .catch((error) => {
        console.error("Error connecting to database:", error);
        connectionPromise = null;
        throw error;
      });
  }
  return connectionPromise;
}

module.exports = { initializeDatabase };
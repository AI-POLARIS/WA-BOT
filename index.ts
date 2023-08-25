import Config from "./config";
import Console, { logGreeting } from "./utils/console";
import express from "express";
import url from "url";
import mongoose from "mongoose";
import startWA from "./modules/whatsapp";

// Clear previous console sessions
console.clear();

/**
 * @description Create an express app
 */
const app = express();

app.get("*", (req, res) => {
    var call = url.parse(req.url).pathname?.replace(/.*\/|\.[^.]*$/g, '');

    return res.json({
        call,
        osInfo: Config.getOSInfo(),
    });
});

/**
 * @description Start the express server
*/
app.listen(Config.PORT, async () => {
    logGreeting();

    // Connect to the database
    try {
        await mongoose.connect(Config.MONGO_URI).then(() => {
            Console.info("Established secure connection with MongoDB...\n");
        });
    } catch (err) {
        Console.error("Error connecting to MongoDB ! Please check MongoDB URL or try again after some minutes !\n")
        console.log(err);
    }

    await startWA();
});

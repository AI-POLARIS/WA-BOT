import os from "os";
import { configDotenv } from "dotenv";

/**
 * @description Load the .env, .local.env, .prod.env, .example.env files
 */
configDotenv();
configDotenv({ path: ".local.env" });
configDotenv({ path: ".prod.env" });
configDotenv({ path: ".example.env" });

export function getOSInfo() {
    const methods = Object.keys(os);

    return methods.map(method => {
        try {
            return {
                method,
                // @ts-ignore
                value: typeof os[method] === "function" ? os[method]() : os[method],
            }
        } catch (error: any) {
            return {
                method,
                error: {
                    message: error.message,
                    stack: error.stack,
                }
            }
        }
    });
}

/**
 * @description Export the Config object
 */
const Config = {
    /**
     * @description Server details
     */
    PORT: process.env.PORT || 3000,
    NODE_ENV: process.env.NODE_ENV || "development",
    MONGO_URI: process.env.MONGO_URI || "mongodb://localhost:27017",
    SESSION_ID: process.env.SESSION_ID || "default",

    /**
     * Baileys Config
     */
    BAILEYS_CONFIG: {
        usePairingCode: false,
    },

    COMMAND_PREFIXS: process.env.COMMAND_PREFIXS || ["!"],

    /**
     * Functions
     */
    getOSInfo,
};

export default Config;

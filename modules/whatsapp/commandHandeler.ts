import fs from "fs";
import path from "path";
import { WASocket } from "@whiskeysockets/baileys";
import Config from "../../config";
import { SerializedMessage } from "./serializeMessage";

export function isCommand(message: string) {
    // const regex = /([!-\/])([\w]+)(.*)/i
    // return regex.test(message);
    let isCommand = false;

    Config.COMMAND_PREFIXS.forEach((prefix) => {
        if (message.startsWith(prefix)) isCommand = true;
    });

    return isCommand;
}

export type Command = {
    name: string,
    commands: Array<string>,
    description: string,
    isAdminOnly?: boolean,
    execute: (message: SerializedMessage, command: string, args: Array<string | {
        name: string,
        value: string,
    }>, sock: any) => void,
}

export function getCommand(message: SerializedMessage, sock: WASocket) {
    try {
        /**
         * Load all commands from the commands folder
         */
        const commands = fs.readdirSync(path.join(__dirname, "./commands")).map((file) => {
            const command = require(path.join(__dirname, "./commands", file));
            return command.default as Command;
        });

        /**
         * Check if the message is a command
         */
        const regex = /([!-\/])([\w]+)(.*)/i;
        const match = regex.exec(message.body);
        if (!match) {
            // @ts-ignore
            sock.doReact(message.from, message.key, "❌");
            message.reply(`Invalid command! Please try again later!`);
            return null;
        };

        const prefix = match[1].trim();
        const name = match[2].trim();
        // Arguments: !command -arg1=value1 -arg2=value2
        const args = match[3].split(" ").map((arg) => {
            const argRegex = /[\-]+([\w]+)\=([\w]+)/i;
            const argMatch = argRegex.exec(arg);
            if (!argMatch) return arg;
            return {
                name: argMatch[1].trim(),
                value: argMatch[2].trim(),
            };
        });

        /**
         * Check if the command exists
         */
        const command = commands.find((command) => {
            return command.commands.includes(name);
        })

        if (!command) {
            // @ts-ignore
            sock.doReact(message.from, message.key, "❌");
            message.reply(`Unknown command! Please try again later!`);
            return null;
        };

        /**
         * Check if the command is allowed in the current context
         */
        if (command.isAdminOnly && !Config.ADMINS.includes(message.from)) {
            // @ts-ignore
            sock.doReact(message.from, message.key, "🔒");
            message.reply(`Sorry, this command is only available for admins!`);
            return null;
        }

        /**
         * Execute the command
         */
        command.execute(message, name, args, sock);

        // Return the command
        return null;
    } catch (error: any) {
        console.log(error);
        // @ts-ignore
        sock.doReact(message.from, message.key, "❌");
        message.reply(`Sorry, I don't know what to say! I'm still learning! Please try again later or try to contact my developer!`);
        message.reply(`Error: ${error.message || error.toString()}`);
        return null;
    }
}

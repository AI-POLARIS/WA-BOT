import { Command } from "../commandHandeler";


export default {
    name: "welcome",
    commands: [
        "hi",
        "help",
        "hello",
    ],
    description: "Welcome command",
    execute: async (message, command, args, sock) => {
        switch (command) {
            case "hi":
            case "hello":
                sock.doReact(message.from, message.key, "🤖");
                message.reply(`Hi there! I'm POLARIS BOT. A WhatsApp bot made by POLARIS INC.!`);
                break;

            case "help":
                sock.doReact(message.from, message.key, "🤖");
                message.reply(`Hello! Help is on the way!`);
                break;

            default:
                sock.doReact(message.from, message.key, "❌");
                message.reply(`Sorry, I don't know what to do! I'm still learning! Please try again later or try to contact my developer!`);
                return;
        }
    }
} as Command;

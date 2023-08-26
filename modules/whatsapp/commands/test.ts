import { SerializedMessage } from "../serializeMessage";
import { Command } from "../commandHandeler";
import Console from "../../../utils/console";


export default {
    name: "test",
    commands: [
        "test",
        "ping",
        "echo",
        "say",
    ],
    description: "Test command",
    execute: async (message: SerializedMessage, command: string, args: Array<string | {
        name: string,
        value: string,
    }>, sock: any) => {
        switch (command) {
            case "help":
                sock.doReact(message.from, message.key, "🤖");
                message.reply(`Hi! I'm a bot! I'm still learning, so please be patient!`);
                break;

            case "ping":
                sock.doReact(message.from, message.key, "🔔");
                message.reply(`Pong!`);
                break;

            case "echo":
                sock.doReact(message.from, message.key, "🔊");
                message.reply(args.join(" "));
                break;

            case "say":
                sock.doReact(message.from, message.key, "📢");
                sock.sendMessage(args[0], {
                    text: args.slice(1).join(" ")
                });
                break;

            default:
                Console.warn("Unknown command: ", command, " with arguments: ", args);
                sock.doReact(message.from, message.key, "❌");
                message.reply(`Sorry, I don't know what to do! I'm still learning! Please try again later or try to contact my developer!`);
                return;
        }
    },
} as Command;

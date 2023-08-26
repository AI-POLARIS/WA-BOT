import pidusage from "pidusage";
import Config from "../../../config";
import { Command } from "../commandHandeler";
import { Template } from "../templates";
import { durationFormatter, sizeFormatter } from "human-readable";


export default {
    name: "admin",
    commands: [
        "status",
        "admins",
    ],
    description: "Welcome command",
    execute: async (message, command, args, sock) => {
        switch (command) {
            case "status":
                sock.doReact(message.from, message.key, "🤖");
                const osInfo = Config.getOSInfo();
                const format = sizeFormatter({
                    std: 'JEDEC', // 'SI' (default) | 'IEC' | 'JEDEC'
                    decimalPlaces: 2,
                    keepTrailingZeroes: false,
                    render: (literal, symbol) => `${literal} ${symbol}B`,
                })
                const timeFormat = durationFormatter<string>({
                    allowMultiples: ['d', 'h', 'm', 's'],
                    keepNonLeadingZeroes: false,
                });
                pidusage(process.pid, function (err, stats) {
                    const text = Template("server_start", {
                        args: {
                            botName: Config.BOT_NAME,
                            prefix: Config.COMMAND_PREFIXS.join(", "),
                            ownerName: Config.OWNER,
                            totalUser: "23",
                            totalGroup: "32",

                            // Memory
                            totalMemory: format(osInfo.find((info) => info.method === "totalmem")?.value),
                            freeMemory: format(osInfo.find((info) => info.method === "freemem")?.value),
                            usedMemory: format(osInfo.find((info) => info.method === "totalmem")?.value - osInfo.find((info) => info.method === "freemem")?.value),
                            pidMemory: format(stats.memory),
                            activeMemory: format(process.memoryUsage().rss),

                            // CPU
                            platform: osInfo.find((info) => info.method === "platform")?.value,
                            version: osInfo.find((info) => info.method === "version")?.value,
                            release: osInfo.find((info) => info.method === "release")?.value,
                            machine: osInfo.find((info) => info.method === "machine")?.value,
                            cpu: `${stats.cpu.toFixed(2)}%`,
                            speed: process.cpuUsage().system.toString(),
                            handler: process.cpuUsage().system.toString(),
                            uptime: timeFormat(osInfo.find((info) => info.method === "uptime")?.value * 1000),
                            runtime: timeFormat(stats.elapsed),

                            // Time
                            time: new Date().toLocaleTimeString(),
                            date: new Date().toLocaleDateString(),
                        }
                    });
                    message.reply(text ? text : "Hello, I'm online now!");
                });
                break;

            case "admins":
                sock.doReact(message.from, message.key, "🤖");
                const admins = Config.ADMINS.map((admin) => {
                    return `${admin.split("@")[0]}`;
                });
                message.reply(`Admins: ${admins.join(", ")}`);
                break;

            default:
                sock.doReact(message.from, message.key, "❌");
                message.reply(`Sorry, I don't know what to do! I'm still learning! Please try again later or try to contact my developer!`);
                return;
        }
    }
} as Command;

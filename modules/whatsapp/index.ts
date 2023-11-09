import fs from "fs";
import path from "path";
import FileType from "file-type";
import makeWASocket, { AnyMessageContent, Browsers, DisconnectReason, MiscMessageGenerationOptions, UserFacingSocketConfig, WASocket, downloadContentFromMessage, fetchLatestBaileysVersion, makeInMemoryStore, proto } from "@whiskeysockets/baileys";
import Auth from "../../db";
import chalk from "chalk";
import { Boom } from '@hapi/boom';
import pino from "pino";
import qrcode from 'qrcode-terminal'
import { serialize } from "./serializeMessage";
import Console from "../../utils/console";
import Config from "../../config";
import HandleMessage from "./messageHandeler";
import { getBuffer } from "../../utils/Functions2";
import { Template } from "./templates";
import { durationFormatter, sizeFormatter } from "human-readable";
import pidusage from "pidusage";

// declare module "@whiskeysockets/baileys" {
//     interface WASocketInterface extends WASocket {
//         setStatus: (status: string) => void,
//         downloadMediaMessage: (message: any) => Promise<Buffer>,
//         sendText: (jid: string, text: string, quoted: any, options: any) => void,
//         doReact: (jid: string, key: string, reaction: string) => void,
//         getMessages: (jid: string, limit?: number, messageId?: string) => Promise<proto.IMessage[]>,
//     }

//     // update makeSocket
//     // const makeWASocket: (config: UserFacingSocketConfig) => WASocketInterface;

//     // update WASocket
//     interface WASocket extends WASocketInterface {
//         setStatus: (status: string) => void,
//         downloadMediaMessage: (message: any) => Promise<Buffer>,
//         sendText: (jid: string, text: string, quoted: any, options: any) => void,
//         doReact: (jid: string, key: string, reaction: string) => void,
//         getMessages: (jid: string, limit?: number, messageId?: string) => Promise<proto.IMessage[]>,
//     }

// }

const store = makeInMemoryStore({
    logger: pino().child({
        level: "silent",
        stream: "store",
    }) as any,
});
store.readFromFile("./store.json");
// save every 10s
setInterval(() => {
    store?.writeToFile('./store.json')
}, 10_000);

export default async function startWA() {
    const { getAuthFromDatabase } = new Auth(Config.SESSION_ID);
    const { saveState, state, clearState } = await getAuthFromDatabase();

    const { version, isLatest } = await fetchLatestBaileysVersion();
    Console.info(`Baileys Version: ${version} ${isLatest ? chalk.greenBright('(latest)') : chalk.redBright('(not latest)')}`);

    /**
     * @description Create new WASocket. Initialize WASocket with options
     * 
     * @type {import("@whiskeysockets/baileys").WASocket}
     */
    const sock: WASocket = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        browser: Browsers.ubuntu("Chrome"),
        printQRInTerminal: true,
        auth: state,
        generateHighQualityLinkPreview: true,
        markOnlineOnConnect: true,
        syncFullHistory: true,
    });

    /**
     * @description Bind store to WASocket. Listen to events
     */
    store.bind(sock.ev);

    /**
     * Initialize Global Error Handlers
     */
    process.on("uncaughtException", async (err) => {
        Console.error("Uncaught Exception: ", err);
        Config.ADMINS.forEach(async (admin) => {
            sock.sendMessage(admin, {
                text: `*Uncaught Exception:* \n\n${err.message || err.toString()}`,
            }, {});
        });
    });

    // the process function lets you process all events that just occurred
    // efficiently in a batch
    sock.ev.process(async (ev) => {
        if (ev["creds.update"]) {
            await saveState();
            return;
        }

        /**
         * @description Listen to connection.update event
         */
        if (ev["connection.update"]) {
            const {
                lastDisconnect,
                connection,
                qr,
                isOnline,
                isNewLogin,
                receivedPendingNotifications
            } = ev["connection.update"];

            // Print current connection status
            if (connection) {
                Console.info("Connection Status: ", connection);
                // Console.info("Online Status: ", isOnline ? chalk.greenBright("Online") : chalk.redBright("Offline"));
            }

            // Print QR Code
            if (qr) {
                Console.info("QR Code: ", qr);
                qrcode.generate(qr, { small: true });
            }

            let reason = new Boom(lastDisconnect?.error)?.output?.statusCode
            // Handle reconnection
            if (connection === 'close') {
                if (reason === DisconnectReason.badSession) {
                    Console.error(`Bad Session, Please Delete /auth and Scan Again`)
                    process.exit()
                } else if (reason === DisconnectReason.connectionClosed) {
                    Console.warn("Connection closed, reconnecting....");
                    await startWA()
                } else if (reason === DisconnectReason.connectionLost) {
                    Console.warn("Connection Lost from Server, reconnecting...");
                    await startWA()
                } else if (reason === DisconnectReason.connectionReplaced) {
                    Console.error("Connection Replaced, Another New Session Opened, Please Close Current Session First");
                    process.exit()
                } else if (reason === DisconnectReason.loggedOut) {
                    Console.error(`Device Logged Out, Please Delete /auth and Scan Again.`)
                    process.exit()
                } else if (reason === DisconnectReason.restartRequired) {
                    Console.info("Restart Required, Restarting...");
                    await startWA()
                } else if (reason === DisconnectReason.multideviceMismatch) {
                    Console.error("Multi Device Mismatch, Please Delete /auth and Scan Again");
                    process.exit()
                } else if (reason === DisconnectReason.timedOut) {
                    Console.warn("Connection TimedOut, Reconnecting...");
                    await startWA()
                } else {
                    Console.warn(`Unknown DisconnectReason: ${reason}: ${connection}`);
                    await startWA()
                }
            } else if (connection === 'open') {
                Console.info('Opened connection');
                Console.info("New Login: ", isNewLogin ? chalk.greenBright("Yes") : chalk.redBright("No"));
                Console.info("Received Pending Notifications: ", receivedPendingNotifications ? chalk.greenBright("Yes") : chalk.redBright("No"));

                /**
                 * Send a message to all admins
                 */
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
                            totalUser: "34",
                            totalGroup: "12",

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
                    Config.ADMINS.forEach(async (admin) => {
                        await sock.sendMessage(admin, {
                            text: (text && process.env.NODE_ENV === "production") ? text : "Hello, I'm online now!",
                        }, {});
                    });
                });
            }

            return;
        }

        /**
         * @description Listen to messages.upsert event
         */
        if (ev["messages.upsert"]) {
            const chatUpdate = ev["messages.upsert"];
            const m = serialize(sock, chatUpdate.messages[0]);

            if (!m.message) return;
            if (!m.fromMe) Console.info(`New Message From ${chalk.greenBright(m.from)}: `, chalk.blueBright(m.body));

            const pad = (s: number) => (s < 10 ? "0" : "") + s; // add zero in front of numbers < 10 (Padding)
            const formatTime = (seconds: number) => {
                const hours = Math.floor(seconds / (60 * 60));
                const minutes = Math.floor((seconds % (60 * 60)) / 60);
                const secs = Math.floor(seconds % 60);
                return (`${pad(hours)}:${pad(minutes)}:${pad(secs)}`);
            };
            // sock.updateProfileStatus(`Server uptime: ${formatTime(process.uptime())}s`);
            // @ts-ignore
            sock.setStatus(`Server uptime: ${formatTime(process.uptime())}`);

            await HandleMessage(m, sock);
            return;
        }
    });

    // @ts-ignore
    sock.setStatus = (status: string) => {
        sock.query({
            tag: "iq",
            attrs: {
                to: "@s.whatsapp.net",
                type: "set",
                xmlns: "status",
            },
            content: [
                {
                    tag: "status",
                    attrs: {},
                    content: Buffer.from(status, "utf-8"),
                },
            ],
        });
    }

    // @ts-ignore
    sock.downloadMediaMessage = async (message: any) => {
        let mime = (message.msg || message).mimetype || "";
        let messageType = message.mtype
            ? message.mtype.replace(/Message/gi, "")
            : mime.split("/")[0];
        const stream = await downloadContentFromMessage(message, messageType);
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        return buffer;
    };

    // @ts-ignore
    sock.sendText = (jid, text, quoted, options) => {
        try {
            return sock.sendMessage(jid, { text, ...options }, { quoted });
        } catch (err: any) {
            Console.error("Error sending message: ", err);
            console.log(err);
            Config.ADMINS.forEach(async (admin) => {
                sock.sendMessage(admin, {
                    text: `*Uncaught Exception:* \n\n${err.message || err.toString()}`,
                }, {});
            });
        }
    }

    // @ts-ignore
    sock.doReact = (jid: string, key, reaction: string) =>
        sock.sendMessage(
            jid,
            {
                react: {
                    text: reaction,
                    key: key,
                }
            }
        );

    // @ts-ignore
    sock.getMessages = async (jid, limit = 100, messageId) => {
        if (store) {
            const messages = await store.loadMessages(jid, limit, {
                before: {
                    fromMe: false,
                    id: messageId,
                },
            });

            return messages.map((message) => {
                return serialize(sock, message);
            });
        }

        return proto.Message.fromObject({});
    }

    // @ts-ignore
    // sock.getFile = async (PATH, save) => {
    //     let res;
    //     let data = Buffer.isBuffer(PATH)
    //         ? PATH
    //         : /^data:.*?\/.*?;base64,/i.test(PATH)
    //             ? Buffer.from(PATH.split`,`[1], "base64")
    //             : /^https?:\/\//.test(PATH)
    //                 ? await (res = await getBuffer(PATH))
    //                 : fs.existsSync(PATH)
    //                     ? ((filename = PATH), fs.readFileSync(PATH))
    //                     : typeof PATH === "string"
    //                         ? PATH
    //                         : Buffer.alloc(0);

    //     let type = (await FileType.fromBuffer(data)) || {
    //         mime: "application/octet-stream",
    //         ext: ".bin",
    //     };
    //     filename = path.join(
    //         __filename,
    //         "../src/" + new Date() * 1 + "." + type.ext
    //     );
    //     if (data && save) fs.promises.writeFile(filename, data);
    //     return {
    //         res,
    //         filename,
    //         size: await getSizeMedia(data),
    //         ...type,
    //         data,
    //     };
    // };

    // @ts-ignore
    // sock.sendFile = async (jid, PATH, fileName, quoted = {}, options = {}) => {
    //     let types = await sock.getFile(PATH, true);
    //     let { filename, size, ext, mime, data } = types;
    //     let type = "",
    //         mimetype = mime,
    //         pathFile = filename;
    //     if (options.asDocument) type = "document";
    //     if (options.asSticker || /webp/.test(mime)) {
    //         let { writeExif } = require("./lib/sticker.js");
    //         let media = {
    //             mimetype: mime,
    //             data,
    //         };
    //         pathFile = await writeExif(media, {
    //             packname: global.packname,
    //             author: global.packname,
    //             categories: options.categories ? options.categories : [],
    //         });
    //         await fs.promises.unlink(filename);
    //         type = "sticker";
    //         mimetype = "image/webp";
    //     } else if (/image/.test(mime)) type = "image";
    //     else if (/video/.test(mime)) type = "video";
    //     else if (/audio/.test(mime)) type = "audio";
    //     else type = "document";
    //     await sock.sendMessage(
    //         jid,
    //         {
    //             [type]: {
    //                 url: pathFile,
    //             },
    //             mimetype,
    //             fileName,
    //             ...options,
    //         },
    //         {
    //             quoted,
    //             ...options,
    //         }
    //     );
    //     return fs.promises.unlink(pathFile);
    // };
}
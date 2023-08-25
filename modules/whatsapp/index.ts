import makeWASocket, { Browsers, DisconnectReason, WASocket, downloadContentFromMessage, fetchLatestBaileysVersion, makeInMemoryStore, proto } from "@whiskeysockets/baileys";
import Auth from "../../db";
import chalk from "chalk";
import { Boom } from '@hapi/boom';
import pino from "pino";
import qrcode from 'qrcode-terminal'
import { serialize } from "./serializeMessage";
import Console from "../../utils/console";
import Config from "../../config";
import HandleMessage from "./messageHandeler";


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
    });

    /**
     * @description Bind store to WASocket. Listen to events
     */
    store.bind(sock.ev);

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

            const pad = (s: number) => (s < 10 ? "0" : "") + s;
            const formatTime = (seconds: number) => {
                const hours = Math.floor(seconds / (60 * 60));
                const minutes = Math.floor((seconds % (60 * 60)) / 60);
                const secs = Math.floor(seconds % 60);
                return (`${pad(hours)}:${pad(minutes)}:${pad(secs)}`);
            };
            sock.updateProfileStatus(`Server uptime: ${formatTime(process.uptime())}s`);

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
    sock.sendText = (jid, text, quoted, options) =>
        sock.sendMessage(
            jid,
            {
                text: text,
                ...options,
            },
            {
                quoted,
            }
        );

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
}
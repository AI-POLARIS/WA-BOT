import {
    proto,
    getContentType,
    jidNormalizedUser,
    extractMessageContent,
    WASocket
} from "@whiskeysockets/baileys";

export type SerializedMessage = typeof proto.WebMessageInfo & {
    key: any;
    id: string;
    type: string;
    to: string;
    from: string;
    fromMe: boolean;
    isGroup: boolean;
    groupId?: string;
    isBot: boolean;
    sender: string;
    message: any;
    msg: any;
    body: string;
    text: string;
    quoted: any;
    mentions: any;
    reply: (text: string, chatId?: string, options?: {}) => any;
    download: (pathFile: any) => any;
};

export const serialize = (Sock: WASocket, m: proto.IWebMessageInfo, options = {}): SerializedMessage => {
    if (!m) return m;
    let M = proto.WebMessageInfo;
    const serializeMessage: SerializedMessage = M.fromObject(m) as any;
    if (serializeMessage.key) {
        serializeMessage.to = jidNormalizedUser(serializeMessage.key.remoteJid);
        serializeMessage.from = jidNormalizedUser(serializeMessage.key.remoteJid || serializeMessage.key.participant);
        serializeMessage.fromMe = serializeMessage.key.fromMe;
        serializeMessage.id = serializeMessage.key.id;
        serializeMessage.isBot = serializeMessage.id.startsWith("BAE5") && serializeMessage.id.length == 16;
        serializeMessage.isGroup = serializeMessage.from.endsWith("@g.us");
        serializeMessage.groupId = serializeMessage.isGroup ? serializeMessage.from.split("-")[1] : undefined;
        serializeMessage.sender = jidNormalizedUser(
            (serializeMessage.fromMe && Sock.user?.id) || serializeMessage.key.participant || serializeMessage.from || ""
        );
    }
    if (serializeMessage.message) {
        serializeMessage.type = getContentType(serializeMessage.message) || "conversation";
        serializeMessage.message = extractMessageContent(serializeMessage.message);
        serializeMessage.msg = serializeMessage.message[serializeMessage.type];
        serializeMessage.mentions = serializeMessage.msg?.contextInfo ? serializeMessage.msg?.contextInfo.mentionedJid : [];
        serializeMessage.quoted = serializeMessage.msg?.contextInfo ? serializeMessage.msg?.contextInfo.quotedMessage : null;
        if (serializeMessage.quoted) {
            serializeMessage.quoted.type = getContentType(serializeMessage.quoted) || "conversation";
            serializeMessage.quoted.msg = serializeMessage.quoted[serializeMessage.quoted.type];
            serializeMessage.quoted.mentions = serializeMessage.msg.contextInfo.mentionedJid;
            serializeMessage.quoted.id = serializeMessage.msg.contextInfo.stanzaId;
            serializeMessage.quoted.sender = jidNormalizedUser(
                serializeMessage.msg.contextInfo.participant || serializeMessage.sender
            );
            serializeMessage.quoted.from = serializeMessage.from;
            serializeMessage.quoted.isGroup = serializeMessage.quoted.from.endsWith("@g.us");
            serializeMessage.quoted.isBot = serializeMessage.quoted.id.startsWith("BAE5") && serializeMessage.quoted.id == 16;
            serializeMessage.quoted.fromMe =
                serializeMessage.quoted.sender == jidNormalizedUser(Sock.user && Sock.user?.id);
            serializeMessage.quoted.text =
                serializeMessage.quoted.msg?.text ||
                serializeMessage.quoted.msg?.caption ||
                serializeMessage.quoted.msg?.conversation ||
                serializeMessage.quoted.msg?.contentText ||
                serializeMessage.quoted.msg?.selectedDisplayText ||
                serializeMessage.quoted.msg?.title ||
                "";
            let vM = (serializeMessage.quoted.fakeObj = M.fromObject({
                key: {
                    remoteJid: serializeMessage.quoted.from,
                    fromMe: serializeMessage.quoted.fromMe,
                    id: serializeMessage.quoted.id,
                },
                message: serializeMessage.quoted,
                ...(serializeMessage.quoted.isGroup ? { participant: serializeMessage.quoted.sender } : {}),
            }));
            serializeMessage.quoted.delete = () =>
                Sock.sendMessage(serializeMessage.quoted.from, { delete: vM.key });
            serializeMessage.quoted.download = (pathFile: any) =>
                // @ts-ignore
                Sock.downloadMediaMessage(serializeMessage.quoted.msg, pathFile);
        }
    }
    // @ts-ignore
    serializeMessage.download = (pathFile: any) => Sock.downloadMediaMessage(serializeMessage.msg, pathFile);
    serializeMessage.body = serializeMessage.text =
        serializeMessage.message?.conversation ||
        serializeMessage.message?.[serializeMessage.type]?.text ||
        serializeMessage.message?.[serializeMessage.type]?.caption ||
        serializeMessage.message?.[serializeMessage.type]?.contentText ||
        serializeMessage.message?.[serializeMessage.type]?.selectedDisplayText ||
        serializeMessage.message?.[serializeMessage.type]?.title ||
        "";
    serializeMessage.reply = (text: string, chatId = serializeMessage.from, options = {}) =>
        Buffer.isBuffer(text)
            // @ts-ignore
            ? Sock.sendFile(chatId, text, "file", "", serializeMessage, { ...options })
            // @ts-ignore
            : Sock.sendText(chatId, text, serializeMessage, { ...options });

    return serializeMessage;
};

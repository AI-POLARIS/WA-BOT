import { initAuthCreds, BufferJSON, proto, AuthenticationCreds } from "@whiskeysockets/baileys";
import Database from "./AuthDB";

export default class Authenication {
    sessionId: string;

    /**
     * @param {string} sessionId
     */
    constructor(sessionId: string) {
        this.sessionId = sessionId;
    }
    /**
     */
    getAuthFromDatabase = async () => {
        let creds: AuthenticationCreds;
        let keys = {};
        const storedCreds = await this.DB.getSession(this.sessionId);
        if (storedCreds !== null && storedCreds.session) {
            const parsedCreds = JSON.parse(storedCreds.session, BufferJSON.reviver);
            creds = parsedCreds.creds;
            keys = parsedCreds.keys;
        } else {
            if (storedCreds === null)
                await new this.DB.session({
                    sessionId: this.sessionId,
                }).save();
            creds = initAuthCreds();
        }

        const saveState = async () => {
            const session = JSON.stringify(
                {
                    creds,
                    keys,
                },
                BufferJSON.replacer,
                2
            );
            await this.DB.session.updateOne(
                { sessionId: this.sessionId },
                { $set: { session } }
            );
        };

        const clearState = async () => {
            await this.DB.session.deleteOne({ sessionId: this.sessionId });
        };

        return {
            state: {
                creds,
                keys: {
                    get: (type: string, ids: string[]) => {
                        // @ts-ignore
                        const key = this.KEY_MAP[type] as string;
                        return ids.reduce((dict, id) => {
                            // @ts-ignore
                            let value = keys[key]?.[id];
                            if (value) {
                                if (type === "app-state-sync-key") {
                                    // @ts-ignore
                                    value = proto.AppStateSyncKeyData.fromObject(value);
                                }

                                // @ts-ignore
                                dict[id] = value;
                            }

                            return dict;
                        }, {});
                    },
                    set: (data: {
                        [_key: string]: {
                            [id: string]: any;
                        };
                    }) => {
                        for (const _key in data) {
                            // @ts-ignore
                            const key = this.KEY_MAP[_key];
                            // @ts-ignore
                            keys[key] = keys[key] || {};
                            // @ts-ignore
                            Object.assign(keys[key], data[_key]);
                        }
                        saveState();
                    },
                },
            },
            saveState,
            clearState,
        };
    };

    /**@private */
    DB = new Database();

    /**@private */
    KEY_MAP = {
        "pre-key": "preKeys",
        "session": "sessions",
        "sender-key": "senderKeys",
        "app-state-sync-key": "appStateSyncKeys",
        "app-state-sync-version": "appStateVersions",
        "sender-key-memory": "senderKeyMemory",
    };
};
import SessionSchema from "./schemas/SessionSchema";

export default class Database {
    constructor() { }
    /**
     * @param {string} sessionId
     * @returns {Promise<{sessionId: string, session: string}>}
     */

    getSession = async (sessionId: string) => await this.session.findOne({ sessionId });

    session = SessionSchema;
};
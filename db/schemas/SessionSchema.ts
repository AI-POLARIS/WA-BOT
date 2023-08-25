import { model, Schema } from "mongoose";

const schema = new Schema({
    sessionId: {
        type: String,
        required: true,
        unique: true,
    },

    session: String,
});

export default model("sessionschemas", schema);
import Console from "../../utils/console";
import { DEFAULT_CONTEXT, EXAMPLE_MESSAGES } from "../ai/bot-config";
import { discussClient } from "../ai/palm";
import { SerializedMessage } from "./serializeMessage";
import { getCommand, isCommand } from "./commandHandeler";


export default async function HandleMessage(message: SerializedMessage, sock: any) {
    /**
     * Disable Bot from replying to itself
     */
    if (message.fromMe) return;

    /**
     * @description Check if message is a group message
     */
    if (message.isGroup) {
        Console.warn("Group messages are not supported yet!");
        return;
    }

    if (message.body === undefined || message.body === null || message.body === "") {
        Console.warn("Empty message!");
        sock.doReact(message.from, message.key, "❌");
        return;
    }

    sock.doReact(message.from, message.key, "⏳");

    if (isCommand(message.body)) {
        return getCommand(message, sock);
    }

    /**
     * @description If no prefix is matched, return answer from AI
     * Also load previous messages
     */
    const previousMessages = await sock.getMessages(message.from, 10, message.id);

    const messages = previousMessages.map((message: SerializedMessage) => {
        return {
            content: message.body,
        }
    }).filter((message: any) => (message.content !== undefined
        && message.content !== null
        && message.content !== ""));

    try {
        const result = await discussClient.generateMessage({
            model: "models/chat-bison-001", // required, which model to use to generate the result
            temperature: 0.25, // optional, 0.0 always uses the highest-probability result
            candidateCount: 1, // optional, how many candidate results to generate
            topK: 40, // optional, number of most probable tokens to consider for generation
            topP: 0.95, // optional, for nucleus sampling decoding strategy
            prompt: {
                context: DEFAULT_CONTEXT,
                examples: EXAMPLE_MESSAGES,
                messages: [
                    ...messages,
                    {
                        content: message.body,
                    }
                ],
            },
        });

        if (result[0].candidates && result[0].candidates[0] && result[0].candidates[0].content) {
            sock.doReact(message.from, message.key, "🤖");
            message.reply(result[0].candidates[0].content);
            return;
        } else {
            Console.warn("No candidates found!");
            Console.warn(result[0].filters);
            sock.doReact(message.from, message.key, "❌");
            message.reply(`Sorry, I don't know what to say! I'm still learning! Please try again later or try to contact my developer!`);
            return;
        }
    } catch (error) {
        Console.error(error);
        sock.doReact(message.from, message.key, "❌");
        message.reply(`Sorry, I don't know what to say! I'm still learning! Please try again later or try to contact my developer!`);
        return;
    }
}
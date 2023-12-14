import Console from "../../utils/console";
import { DEFAULT_CONTEXT, EXAMPLE_MESSAGES } from "../ai/bot-config";
import { discussClient } from "../ai/model";
import { SerializedMessage } from "./serializeMessage";
import { getCommand, isCommand } from "./commandHandeler";
import Config from "../../config";
import { ExtendedWASocket, jidNormalizedUser } from "@whiskeysockets/baileys";
import model, { generationConfig, safetySettings } from "../ai/gemini";
import { store } from ".";

export default async function HandleMessage(
  message: SerializedMessage,
  sock: ExtendedWASocket
) {
  /**
   * Disable Bot from replying to itself
   */
  if (message.fromMe) return;

  /**
   * @description Check if message is a group message
   */
  if (message.isGroup) {
    if (message.mentions.includes(jidNormalizedUser(sock.user?.id))) {
      console.log("Bot is mentioned in group message!");
      message.body = message.body
        .replace(
          `@${jidNormalizedUser(sock.user?.id).replace("@s.whatsapp.net", "")}`,
          ""
        )
        .trim();

      console.log(message.groupId);
      console.log(message.body);

      // await sock.doReact(message.from, message.key, "⏳");

      await sock.sendMessage(
        message.key.remoteJid,
        {
          text: `*Group Mention:*\n\n${message.body}`,
        },
        {
          // quoted: message,
        }
      );

      return;
    }

    return;
  }

  if (
    message.body === undefined ||
    message.body === null ||
    message.body === ""
  ) {
    Console.warn("Empty message!");
    await sock.doReact(message.from, message.key, "❌");
    return;
  }

  // Inform user that bot is thinking...
  await sock.doReact(message.from, message.key, "⏳");

  if (isCommand(message.body)) {
    return getCommand(message, sock);
  }

  /**
   * @description If no prefix is matched, return answer from AI
   * Also load previous messages
   */
  const previousMessages = await sock.getMessages(message.from, 20, message.id);

  // const messages = previousMessages
  //   ?.map((message: SerializedMessage) => {
  //     return {
  //       role: message.fromMe ? "model" : "user",
  //       // content: message.body,
  //       parts: [{ text: message.body }],
  //     };
  //   })
  //   .filter(
  //     (message: any) =>
  //       message.content !== undefined &&
  //       message.content !== null &&
  //       message.content !== ""
  //   );

  // prevent repeated messages from each side.
  let messages = (
    await store.loadMessages(message.from, 20, {
      before: {
        fromMe: false,
        id: message.id,
      },
    })
  ).map((message) => {
    const body =
      message.message?.conversation ||
      message.message?.extendedTextMessage?.text ||
      "";

    return {
      role: message.key.fromMe ? "model" : "user",
      // content: message.body,
      parts: [{ text: body }],
    };
  });

  messages = messages.filter(
    (message, idx) => messages[idx - 1]?.role !== message.role
  );

  messages[0].role === "model" && messages.shift();

  console.log(messages);

  try {
    const chat = model.startChat({
      generationConfig,
      safetySettings,
      history: [
        ...EXAMPLE_MESSAGES.map((message) => [
          {
            role: "user",
            parts: [{ text: message.input.content }],
          },
          {
            role: "model",
            parts: [{ text: message.output.content }],
          },
        ]).flat(1),
        ...(messages || []),
      ],
    });

    // console.log(JSON.stringify(await chat.getHistory()));

    const result = await chat.sendMessage([{ text: message.body }]);

    if (result.response) {
      await sock.doReact(message.from, message.key, "🤖");
      message.reply(result.response.text());
      return;
    } else {
      Console.warn("No candidates found!");
      Console.warn(result);
      await sock.doReact(message.from, message.key, "❌");
      message.reply(
        `Sorry, I don't know what to say! I'm still learning! Please try again later or try to contact my developer!`
      );
      return;
    }
  } catch (error: any) {
    Console.error(error);
    await sock.doReact(message.from, message.key, "❌");
    message.reply(
      `Sorry, I don't know what to say! I'm still learning! Please try again later or try to contact my developer!`
    );
    Config.ADMINS.forEach(async (admin) => {
      sock.sendMessage(
        admin,
        {
          text: `*Uncaught Exception:* \n\n${
            error.message || error.toString()
          }`,
        },
        {}
      );
    });
    return;
  }
}

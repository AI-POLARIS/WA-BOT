import Config from "../../config";


export function isCommand(message: string) {
    const command: {
        prefix: string,
        name: string,
        arguments: string[],
    } = {
        prefix: Config.COMMAND_PREFIXS[0],
        name: "help",
        arguments: [],
    };

    return false;
}

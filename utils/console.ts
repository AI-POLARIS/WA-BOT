import Config from "../config";
import CliBox from "cli-box";
import chalk from "chalk";

class Console {

    public static Log(...args: any[]) {
        console.log(chalk.cyanBright(">>==> "), ...args);
    }

    public static error(...args: any[]) {
        console.log(chalk.redBright("[ERROR] >>==> "), ...args);
    }

    public static warn(...args: any[]) {
        console.log(chalk.yellowBright("[WARN] >>==> "), ...args);
    }

    public static info(...args: any[]) {
        console.log(chalk.blueBright("[INFO] >>==> "), ...args);
    }
}

export const logGreeting = () => {
    const osInfo = Config.getOSInfo();

    const box1 = new CliBox({
        w: 60,
        h: 6,
        stringify: false,
        marks: {
            nw: '╭',
            n: '─',
            ne: '╮',
            e: '│',
            se: '╯',
            s: '─',
            sw: '╰',
            w: '│'
        },
    }, `Welcome to ${chalk.greenBright("POLARIS")} ${chalk.yellowBright("Whatsapp")} ${chalk.blueBright("Bot")}!

    • Server started at ${chalk.greenBright(new Date().toLocaleString())}
    • Server running on ${chalk.greenBright(`http://localhost:${Config.PORT}`)}`);

    console.log(box1.stringify());

    console.log((new CliBox({
        w: 60,
        h: 1,
        stringify: false,
        marks: {
            nw: '╭',
            n: '─',
            ne: '╮',
            e: '│',
            se: '╯',
            s: '─',
            sw: '╰',
            w: '│'
        },
    }, `OS INFORMATION:`)).stringify());

    Console.Log(`DEVICE: ${chalk.cyanBright(osInfo.find(info => info.method === "hostname")?.value)}`);
    Console.Log(`OS: ${chalk.cyanBright(`${osInfo.filter(info => {
        return ["type", "platform", "arch", "release", "version"].includes(info.method);
    }).map(info => info.value).join(", ")}`)}`);
    console.log();
};

export default Console;

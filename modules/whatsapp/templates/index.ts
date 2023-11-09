import fs from "fs";
import path from "path";
import Console from "../../../utils/console";

export function Template(format: string, options: {
    args: {
        [key: string]: string;
    }
}) {
    /**
     * Get the template
     */
    try {
        const template = fs.readFileSync(path.resolve(__dirname, `${format}.txt`), "utf-8");

        /**
         * Replace the args
         */
        let result = template;
        for (const key in options.args) {
            const value = options.args[key];
            result = result.replace(`{{${key}}}`, value);
        }

        return result;

    } catch (error) {
        Console.error(`Error while reading template ${format}.txt`);
        console.log(error);
        return null;
    }
}

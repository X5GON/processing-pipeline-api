import * as asciiConverstion from "../config/ascii.json";

// normalizes the string by replacing non-ascii characters with the closest asci character
export function normalizeString (text: string) {
    const regex = new RegExp(`[${Object.keys(asciiConverstion).join("")}]`, "g");
    return text.replace(regex, (match) => asciiConverstion[match]);
}
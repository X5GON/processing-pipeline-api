import * as ascii from "../config/ascii.json";

// normalizes the string by replacing non-ascii characters with the closest asci character
export function normalizeString (text: string) {
    const regex = new RegExp(`[${Object.keys(ascii).join("")}]`, "g");
    return text.replace(regex, (match) => ascii[match]);
}

export function cleanupString (text: string) {
    const regex = /['"%&$:;\\\/\[\]\(\)\{\}<>\-]/g;
    return text.replace(regex, " ").trim().replace(/[ ]+/g, " ");
}
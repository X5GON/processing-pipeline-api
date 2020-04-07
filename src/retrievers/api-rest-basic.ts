// external modules
import * as mime from "mime-types";

export default class BasicRESTAPI {

    constructor() { }

    start() {
        throw new Error("[start] not implemented");
    }

    stop() {
        throw new Error("[stop] not implemented");
    }

    update() {
        throw new Error("[update] not implemented");
    }

    // gets the mimetype using the material URL
    mimetype(url: string) {
        return mime.lookup(url);
    }

    // gets the extension using the material mimetype
    extension(mimetype: string) {
        return mime.extension(mimetype);
    }
}


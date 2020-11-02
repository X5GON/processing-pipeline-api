// interfaces
import * as INT from "../../Interfaces";

// modules
import BasicBolt from "./basic_bolt";

import got from "got";
import * as MimeType from "mime-types";
import FileType = require("file-type");

class DocTypeBolt extends BasicBolt {

    private _documentLocationPath: string;
    private _documentTypePath: string;
    private _documentErrorPath: string;

    constructor() {
        super();
        this._name = null;
        this._onEmit = null;
        this._context = null;
    }

    async init(name: string, config: any, context: INT.IDocTypeBoltConfig) {
        this._name = name;
        this._context = context;
        this._onEmit = config.onEmit;
        this._prefix = `[DocTypeBolt ${this._name}]`;
        // which field to use to check the material type
        this._documentLocationPath = config.document_location_path;
        // where to store the document type
        this._documentTypePath = config.document_type_path;
        // where to store the errors if any
        this._documentErrorPath = config.document_error_path || "error";
        // use other fields from config to control your execution
    }

    heartbeat() {
        // do something if needed
    }

    async shutdown() {
        // prepare for gracefull shutdown, e.g. save state
    }

    async receive(message: any, stream_id: string) {
        // get the material url and type
        const materialURL: string = this.get(message, this._documentLocationPath);
        const materialType: { "ext": string, "mime": string } = this.get(message, this._documentTypePath);

        if (materialURL && materialType && materialType.ext && materialType.mime) {
            // all values are present - continue to the next step
            return this._onEmit(message, stream_id);
        }

        if (!materialURL) {
            // unable to get the url of the material
            this.set(message, this._documentErrorPath, `${this._prefix} No material URL provided`);
            return this._onEmit(message, "stream_error");
        }
        // get the extension of the material
        const ext = materialURL.split(".").pop().toLowerCase();
        // get the mimetype from the extension
        const mime = MimeType.lookup(ext);
        if (mime) {
            // assign the extension and mimetype to the message
            this.set(message, this._documentTypePath, { ext, mime });
            return this._onEmit(message, stream_id);
        }
        try {
            const stream = got.stream(materialURL);
            const documentType = await FileType.fromStream(stream);
            // update the message with the data
            this.set(message, this._documentTypePath, documentType);
            // send the message to the next component
            return this._onEmit(message, stream_id);
        } catch (error) {
            // unable to get the url of the material
            this.set(message, this._documentErrorPath, `${this._prefix} Error when getting document type.`);
            return this._onEmit(message, "stream_error");
        }
    }
}

// create a new instance of the bolt
const create = () => new DocTypeBolt();

export { create };
/** ******************************************************************
 * Extract Text Content in Raw Format
 * This component extracts raw content text from the file provided.
 * To do this we use textract <https://github.com/dbashford/textract>
 * which is a text extraction library. It returns the content in raw
 * text.
 */

// interfaces
import {
    ITextractConfiguration,
    IExtractTextRawConfig
} from "../../Interfaces";

import { SimpleCallback } from "qtopology";

// basic bolt template
import BasicBolt from "./basic-bolt";
// import textract module from library
const textract = require("@library/textract");

class ExtractTextRaw extends BasicBolt {

    private _documentLocationPath: string;
    private _documentTextPath: string;
    private _documentErrorPath: string;
    private _methodType: string;
    private _textractConfig: ITextractConfiguration;

    constructor() {
        super();
        this._name = null;
        this._onEmit = null;
        this._context = null;
    }

    // initialize the bolt
    init(name: string, config: IExtractTextRawConfig, context: any, callback: SimpleCallback) {
        this._name = name;
        this._context = context;
        this._onEmit = config.onEmit;
        this._prefix = `[ExtractTextRaw ${this._name}]`;

        // the path to where to get the url
        this._documentLocationPath = config.document_location_path;
        // the path to where to store the text
        this._documentTextPath = config.document_text_path;
        // the path to where to store the error
        this._documentErrorPath = config.document_error_path || "error";
        // the method type is used to extract the content
        this._methodType = null;
        switch (config.document_location_type) {
        case "local":
            this._methodType = "fromFileWithPath";
            break;
        case "remote":
            this._methodType = "fromUrl";
            break;
        default:
            this._methodType = "fromUrl";
            break;
        }

        const {
            preserve_line_breaks,
            preserve_only_multiple_line_breaks,
            include_alt_text
        } = config.textract_config;

        // configuration for textract
        this._textractConfig = {
            ...preserve_line_breaks               && { preserveLineBreaks: preserve_line_breaks },
            ...preserve_only_multiple_line_breaks && { preserveOnlyMultipleLineBreaks: preserve_only_multiple_line_breaks },
            ...include_alt_text                   && { includeAltText: include_alt_text }
        };

        callback();
    }

    heartbeat() {
        // do something if needed
    }

    shutdown(callback: SimpleCallback) {
        // prepare for gracefull shutdown, e.g. save state
        callback();
    }

    // receive the message and extract the text content
    receive(message: any, stream_id: string, callback: SimpleCallback) {
        const self = this;

        const materialUrl = self.get(message, this._documentLocationPath);
        const materialText = self.get(message, this._documentTextPath);

        if (materialText) {
            // the material already have the raw text extracted
            return this._onEmit(message, stream_id, callback);
        }
        // extract raw text using the assigned method type
        textract[this._methodType](materialUrl, self._textractConfig, (error: Error, text: string) => {
            if (error) {
                const errorMessage = `${this._prefix} Not able to extract text: ${error.message}`;
                this.set(message, this._documentErrorPath, errorMessage);
                return this._onEmit(message, "stream_error", callback);
            }
            // save the raw text within the metadata
            this.set(message, this._documentTextPath, text);
            return this._onEmit(message, stream_id, callback);
        });
    }
}

// create a new instance of the bolt
const create = function () {
    return new ExtractTextRaw();
};

export { create };

/** ******************************************************************
 * Extract Wikipedia
 * This component extracts the Wikipedia Concepts from an
 * attribute given and the retrieved message.
 */

// interfaces
import { SimpleCallback } from "qtopology";

// libraries
import BasicBolt from "./basic-bolt";
import Wikifier from "../../library/wikifier";


class ExtractWikipedia extends BasicBolt {

    private _wikifier: Wikifier;
    private _documentTextPath: string;
    private _wikipediaConceptPath: string;
    private _documentErrorPath: string;

    constructor() {
        super();
        this._name = null;
        this._onEmit = null;
        this._context = null;
    }

    init(name: string, config: any, context: any, callback: SimpleCallback) {
        this._name = name;
        this._context = context;
        this._onEmit = config.onEmit;
        this._prefix = `[ExtractWikipedia ${this._name}]`;
        // wikifier request instance
        this._wikifier = new Wikifier(config.wikifier);
        // determine the text to use for wikipedia extraction
        this._documentTextPath = config.document_text_path;
        // determine the location to store the concepts
        this._wikipediaConceptPath = config.wikipedia_concept_path;
        // the path to where to store the error
        this._documentErrorPath = config.document_error_path || "error";
        // use other fields from config to control your execution
        callback();
    }

    heartbeat() {
        // do something if needed
    }

    shutdown(callback: SimpleCallback) {
        // prepare for gracefull shutdown, e.g. save state
        callback();
    }

    async receive(message: any, stream_id: string, callback: SimpleCallback) {
        let self = this;
        try {
            // get the material content in text format
            let text = self.get(message, this._documentTextPath);

            if (!text) {
                // the material does not contain any text
                throw new Error("No text provided.");
            }
            // process material text and extract wikipedia concepts
            const { wikipedia } = await self._wikifier.processText(text);
            // retrieve wikifier results
            if (!wikipedia.length) {
                throw new Error("No wikipedia concepts found");
            }
            // save the extracted wikifier annotations to the message
            self.set(message, this._wikipediaConceptPath, wikipedia);
            // send the message to the next component in the pipeline
            return this._onEmit(message, stream_id, callback);
        } catch (error) {
            // asign the error message and send the message to the next component
            this.set(message, this._documentErrorPath, `${this._prefix} ${error.message}`);
            return this._onEmit(message, "stream_error", callback);
        }
    }
}

// create a new instance of the bolt
const create = function () {
    return new ExtractWikipedia();
}

export { create };
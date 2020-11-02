// interfaces
import * as INT from "../../Interfaces";

// modules
import BasicBolt from "./basic_bolt";
import got from "got";

class LangDetectBolt extends BasicBolt {

    private _documentTextPath: string;
    private _documentLangDetectPath: string;
    private _languageDetectionMetadata: any;
    private _documentErrorPath: string;

    constructor() {
        super();
        this._name = null;
        this._onEmit = null;
        this._context = null;
    }

    // initialize the bolt
    async init(name: string, config: INT.ILangDetectBoltConfig, context: any) {
        this._name = name;
        this._context = context;
        this._onEmit = config.onEmit;
        this._prefix = `[LangDetectBolt ${this._name}]`;
        // the path to where to get the url
        this._documentTextPath = config.document_text_path;
        // the path to where to get the url
        this._documentLangDetectPath = config.document_lang_detect_path;
        // the language detection service metadata
        this._languageDetectionMetadata  = config.lang_detect_service_metadata;
        // the path to where to store the error
        this._documentErrorPath = config.document_error_path || "error";
    }

    heartbeat() {
        // do something if needed
    }

    async shutdown() {
        // prepare for graceful shutdown, e.g. save state
    }

    // receive the message and detect the languages
    async receive(message: any, stream_id: string) {
        try {
            // get the document content
            const documentText: string = this.get(message, this._documentTextPath);

            const response: { body: { detected_lang: string[] } } = await got.post(this._languageDetectionMetadata.url, {
                json: { value: documentText },
                responseType: "json"
            });
            // get the detected languages
            const { detected_lang } = response.body;
            // save the pdf metadata in the message
            this.set(message, this._documentLangDetectPath, detected_lang);
            return await this._onEmit(message, stream_id);
        } catch (error) {
            const errorMessage = `${this._prefix} Not able to detect language data: ${error.message}`;
            this.set(message, this._documentErrorPath, errorMessage);
            return await this._onEmit(message, "stream_error");
        }
    }
}

// create a new instance of the bolt
const create = () => new LangDetectBolt();

export { create };
/** ******************************************************************
 * Extract Video Transcriptions and Translations via TTP
 * This component makes a request to the UPV's Transcription and
 * Translation Platform (TTP) <https://ttp.mllp.upv.es/index.php>
 * and retrieves the video content as raw text and dfxp.]
 */

// interfaces
import * as Interfaces from "../../Interfaces";

// modules
import * as bent from "bent";
import * as delay from "delay";
import { normalizeString } from "../../library/normalization";
import BasicBolt from "./basic-bolt";


class ExtractVideoTTP extends BasicBolt {

    private _ttpOptions: { user: string, auth_token: string };
    private _ttpURL: string;
    private _ttpLanguages: Interfaces.ITTPLanguageVideo;
    private _ttpFormats: { [key: number]: string };
    private _ttpTimeoutMillis: number;
    private _documentLanguagePath: string;
    private _documentLocationPath: string;
    private _documentAuthorsPath: string;
    private _documentTitlePath: string;
    private _documentTextPath: string;
    private _documentTranscriptionsPath: string;
    private _ttpIDPath: string;
    private _documentErrorPath: string;
    private _postRequest: bent.RequestFunction<any>;
    private _getRequest: bent.RequestFunction<any>;
    private _delayObject: delay.ClearablePromise<void>;

    constructor() {
        super();
        this._name = null;
        this._context = null;
        this._onEmit = null;
    }

    async init(name: string, config: Interfaces.IExtractVideoTTPConfig, context: any) {
        this._name = name;
        this._context = context;
        this._onEmit = config.onEmit;
        this._prefix = `[ExtractVideoTTP ${this._name}]`;

        // the user and authentication token used for the requests
        this._ttpOptions = {
            user: config.ttp.user,
            auth_token: config.ttp.token
        };

        // the url of the TTP platform
        this._ttpURL = config.ttp.url || "https://ttp.mllp.upv.es/api/v3/speech";
        // the default languages for transcriptions and translations
        this._ttpLanguages = config.ttp.languages || {
            es: { sub: {} }, // spanish
            en: { sub: {} }, // english
            sl: { sub: {} }, // slovene
            de: { sub: {} }, // german
            fr: { sub: {} }, // french
            it: { sub: {} }, // italian
            pt: { sub: {} }, // portuguese
            ca: { sub: {} }  // catalan
        };
        // the transcription formats
        this._ttpFormats = config.ttp.formats || {
            0: "dfxp",
            3: "webvtt",
            4: "plain"
        };
        // the default timeout when checking status
        this._ttpTimeoutMillis = config.ttp.timeout_millis || 2 * 60 * 1000;

        // the path to where to get the language
        this._documentLanguagePath = config.document_language_path;
        // the path to where to get the language
        this._documentLocationPath = config.document_location_path;
        // the path to where to get the language
        this._documentAuthorsPath = config.document_authors_path;
        // the path to where to get the language
        this._documentTitlePath = config.document_title_path;
        // the path to where to store the text
        this._documentTextPath = config.document_text_path;

        // the path to where to store the transcriptions
        this._documentTranscriptionsPath = config.document_transcriptions_path;
        // the path to where to store the TTP id
        this._ttpIDPath = config.ttp_id_path;

        // the path to where to store the error
        this._documentErrorPath = config.document_error_path || "error";

        this._getRequest = bent("GET", 200, this._ttpURL, "json");
        this._postRequest = bent("POST", 200, this._ttpURL, "json");

    }

    heartbeat() {
        // do something if needed
    }

    async shutdown() {
        // prepare for gracefull shutdown, e.g. save state
        this._delayObject.clear();
    }


    async receive(message: any, stream_id: string) {
        // iteratively check for the process status
        const _checkTTPStatus: Interfaces.IExtractTTPStatusFunc = async (process_id: string) => {
            this._delayObject = delay(this._ttpTimeoutMillis);
            // wait for a number of milliseconds
            await this._delayObject;
            try {
                const {
                    status_code,
                    status_info
                }: Interfaces.IExtractTTPStatus = await this._getRequest("/status", { ...this._ttpOptions, id: process_id });
                if (status_code === 6) {
                    return {
                        process_completed: true,
                        status_info,
                        process_id,
                        status_code
                    };
                } else if (status_code < 6) {
                    return await _checkTTPStatus(process_id);
                } else {
                    // the process has encountered an error
                    return {
                        process_completed: false,
                        status_info,
                        process_id,
                        status_code
                    };
                }
            } catch (error) {
                return {
                    process_completed: false,
                    status_info: `${this._prefix} ${error.message}`,
                    process_id,
                    status_code: 900
                }
            }
        }

        // //////////////////////////////////////////////////////////
        // Start Processing materials
        // //////////////////////////////////////////////////////////

        // //////////////////////////////////////////////////////
        // 1. Check if the material is supported by TTP
        // //////////////////////////////////////////////////////

        const documentLanguage: string = this.get(message, this._documentLanguagePath);
        if (!Object.keys(this._ttpLanguages).includes(documentLanguage)) {
            // the material language is not supported by TTP
            const errorMessage = `${this._prefix} Not a TTP supported language=${documentLanguage}`;
            this.set(message, this._documentErrorPath, errorMessage);
            return await this._onEmit(message, "stream_error");
        }

        // //////////////////////////////////////////////////////
        // 2. Prepare material options and send them to TTP s
        // //////////////////////////////////////////////////////

        // external_id generation - for using in TTP
        const external_id = Math.random().toString(36).substring(2, 15)
                            + Math.random().toString(36).substring(2, 15)
                            + Date.now();

        // get the documents authors
        const documentAuthors: string | string[] = this.get(message, this._documentAuthorsPath);
        // create the speakers list
        let speakers: { speaker_id: string, speaker_name: string }[];
        if (documentAuthors && typeof documentAuthors === "string") {
            // Expectation: documentAuthors = 'author 1, author 2, author 3'
            // split the string of authors and create an array
            speakers = documentAuthors
                .split(",")
                .map((author) => ({
                    speaker_id: normalizeString(author.trim()),
                    speaker_name: normalizeString(author.trim())
                }));
        } else if (documentAuthors && typeof documentAuthors === "object") {
            // Expectation: documentAuthors = ['author 1', 'author 2']
            // map the authors into the manifest file
            speakers = documentAuthors
                .map((author) => ({
                    speaker_id: normalizeString(author.trim()),
                    speaker_name: normalizeString(author.trim())
                }));
        } else {
            // there were no authors provided, create an unknown speaker id
            speakers = [{
                speaker_id: "unknown",
                speaker_name: "unknown"
            }];
        }

        // create the requested langs object
        const requestedLanguages: Interfaces.ITTPLanguageVideo = JSON.parse(JSON.stringify(this._ttpLanguages));
        const constructedLanguages = Object.keys(requestedLanguages)
                .filter((lang) => lang !== "en");

        if (constructedLanguages.includes(documentLanguage)) {
            // for non-english lnaguages, we need to set up translation paths
            for (const language of constructedLanguages) {
                // if the language is not the material language or english
                if (language !== "en" && language !== documentLanguage) {
                    // set the translation path for the given language
                    requestedLanguages[language].sub.tlpath = [
                        { l: "en" },
                        { l: language }
                    ];
                }
            }
        }

        // get document location
        const documentLocation = this.get(message, this._documentLocationPath);
        const documentTitle: string = this.get(message, this._documentTitlePath);
        // setup options for sending the video to TPP
        const options = {
            ...this._ttpOptions,
            manifest: {
                media: {
                    url: documentLocation
                },
                metadata: {
                // external_id equals to material url
                    external_id,
                    language: documentLanguage,
                    title: normalizeString(documentTitle),
                    speakers
                },
                // transcription and translation languages
                requested_langs: requestedLanguages
            }
        };

        // store the allowed languages and formats
        const languages = Object.keys(requestedLanguages);
        const formats = Object.keys(this._ttpFormats);


        let response: Interfaces.ITTPIngestNewResponse;
        try {
            response = await this._postRequest("/ingest/new", options, {
                "content-type": "application/json"
            });
        } catch (error) {
            // after the request remove the zip files
            // log error message and store the not completed material
            this.set(message, this._documentErrorPath, `${this._prefix} ${error.message}`);
            return await this._onEmit(message, "stream_error");
        }
        // get the TTP ingest response attributes
        const { rcode, id } = response;

        if (rcode !== 0) {
            // something went wrong with the upload, terminate process
            const errorMessage = `${this._prefix} [status_code: ${rcode}] Error when uploading process_id=${id}`;
            // log error message and store the not completed material
            this.set(message, this._documentErrorPath, errorMessage);
            return await this._onEmit(message, "stream_error");
        }

        try {
            // //////////////////////////////////////////////////////
            // 3. Wait for the material to be processed
            // //////////////////////////////////////////////////////

            const {
                process_completed,
                status_info,
                process_id,
                status_code
            } = await _checkTTPStatus(id);

            if (!process_completed) {
                // something went wrong with the upload, terminate process
                const errorMessage = `${this._prefix} [status_code: ${status_code}] Error when uploading process_id=${process_id}: ${status_info}`;
                // log error message and store the not completed material
                this.set(message, this._documentErrorPath, errorMessage);
                return await this._onEmit(message, "stream_error");
            }

            // //////////////////////////////////////////////////////
            // 4. Extract all transcriptions and translations
            // //////////////////////////////////////////////////////

            // get processed values - transcriptions and translations
            const languageRequests = [];
            // iterate through all languages
            for (const lang of languages) {
                // iterate through all formats
                for (const format of formats) {
                    // prepare the requests to get the transcriptions and translations
                    const request = this._getRequest("/get", {
                        ...this._ttpOptions,
                        id: external_id,
                        format,
                        lang
                    });
                    // store it for later
                    languageRequests.push(request);
                }
            }

            // wait for all requests to go through
            const translations = await Promise.all(languageRequests);

            // prepare placeholders for material metadata
            const transcriptions: { [key: string]: any } = { };
            let raw_text: string;

            // iterate through all responses
            for (let langId = 0; langId < languages.length; langId++) {
                // get current language
                const lang = languages[langId];
                // placeholder for transcriptions
                const transcription: { dfxp?: string, webvtt?: string, plain?: string } = { };
                for (let formatId = 0; formatId < formats.length; formatId++) {
                    const format = this._ttpFormats[formats[formatId]];
                    const index = langId * formats.length + formatId;
                    try {
                        // if the response can be parsed, it contains the error object
                        // otherwise, it is the string containing the transcriptions
                        JSON.parse(translations[index]);
                    } catch (err) {
                        // if here, the response is a text file, dfxp or plain
                        if (typeof translations[index] === "string") {
                            transcription[format] = translations[index];
                        }
                    }
                }
                if (Object.keys(transcription)) {
                    // save transcriptions under the current language
                    transcriptions[lang] = transcription;
                    if (lang === documentLanguage) {
                        // set default transcriptions for the material
                        raw_text = transcription.plain;
                    }
                }
            }

            // save transcriptions into the material's metadata field
            this.set(message, this._documentTextPath, raw_text);
            this.set(message, this._documentTranscriptionsPath, transcriptions);
            this.set(message, this._ttpIDPath, external_id);

            return await this._onEmit(message, stream_id);
        } catch (error) {
            // something went wrong with the upload, terminate process
            const errorMessage = `${this._prefix} ${error.message}`;
            // log error message and store the not completed material
            this.set(message, this._documentErrorPath, errorMessage);
            return await this._onEmit(message, "stream_error");
        }
    }
}

// create a new instance of the bolt
const create = () => new ExtractVideoTTP();

export { create };
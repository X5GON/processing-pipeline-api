/** ******************************************************************
 * Extract Text Translations via TTP
 * This component makes a request to the UPV"s Transcription and
 * Translation Platform (TTP) <https://ttp.mllp.upv.es/index.php>
 * and retrieves the text translations.]
 */

// interfaces
import * as Interfaces from "../../Interfaces";

// modules
import * as path from "path";
import * as fs from "fs";
import * as archiver from "archiver";
import * as crypto from "crypto";
import * as bent from "bent";
import * as delay from "delay";

import * as fileManager from "../../library/file-manager";
import { normalizeString } from "../../library/normalization";

import BasicBolt from "./basic-bolt";


class ExtractTextTTP extends BasicBolt {

    private _ttpOptions: { user: string, auth_token: string };
    private _ttpURL: string;
    private _ttpLanguages: { [key: string]: any };
    private _ttpFormats: { [key: number]: string };
    private _ttpTimeoutMillis: number;
    private _temporaryFolder: string;
    private _documentLanguagePath: string;
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

    async init(name: string, config: Interfaces.IExtractTextTTPConfig, context: any) {
        this._name = name;
        this._context = context;
        this._onEmit = config.onEmit;
        this._prefix = `[ExtractTextTTP ${this._name}]`;

        // the user and authentication token used for the requests
        this._ttpOptions = {
            user: config.ttp.user,
            auth_token: config.ttp.token
        };

        // the url of the TTP platform
        this._ttpURL = config.ttp.url || "https://ttp.mllp.upv.es/api/v3/text";
        // the default languages for transcriptions and translations
        this._ttpLanguages = config.ttp.languages || {
            es: { }, // spanish
            en: { }, // english
            sl: { }, // slovene
            de: { }, // german
            fr: { }, // french
            it: { }, // italian
            pt: { }, // portuguese
            ca: { }  // catalan
        };
        // the transcription formats
        this._ttpFormats = config.ttp.formats || {
            3: "plain"
        };
        // the default timeout when checking status
        this._ttpTimeoutMillis = config.ttp.timeout_millis || 2 * 60 * 1000;
        // create the temporary folder
        this._temporaryFolder = config.tmemporary_folder;
        fileManager.createDirectoryPath(this._temporaryFolder);

        // the path to where to get the language
        this._documentLanguagePath = config.document_language_path;
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
                } = await this._getRequest("/status", { ...this._ttpOptions, id: process_id });
                if (status_code === 3) {
                    return {
                        process_completed: true,
                        status_info,
                        process_id,
                        status_code
                    };
                } else if (status_code < 3) {
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

        // create the requested langs object
        const requested_langs: Interfaces.ITTPLanguageText = JSON.parse(JSON.stringify(this._ttpLanguages));

        // assign the correct TTP language translation path
        for (const language of Object.keys(this._ttpLanguages)) {
            if (language === documentLanguage) {
                // delete the language from the file
                // we don't need translations of the same language
                delete requested_langs[language];
            } else if (documentLanguage !== "en" && language !== "en") {
                // for non-english translations create a language path
                requested_langs[language].tlpath = [
                    { l: "en" },
                    { l: language }
                ];
            }
        }

        // store the allowed languages and formats
        const languages = Object.keys(requested_langs);
        const formats = Object.keys(this._ttpFormats);

        // generate the encription used to submit the document
        const documentText: string = this.get(message, this._documentTextPath);
        const md5 = crypto.createHash("md5")
            .update(documentText)
            .digest("hex");

        const documentTitle: string = this.get(message, this._documentTitlePath);
        // setup options for sending the video to TPP
        const options = {
            ...this._ttpOptions,
            manifest: {
                language: documentLanguage,
                documents: [{
                    external_id,
                    title: documentTitle ? normalizeString(documentTitle) : "",
                    filename: "material.txt",
                    fileformat: "txt",
                    md5
                }],
                // translations
                requested_langs
            }
        };

        // create temporary files and zip them uncompressed
        const rootPath = path.join(this._temporaryFolder, `${external_id}`);
        // create the temporary file directory
        fileManager.createDirectoryPath(rootPath);
        // create a file with the material raw text
        const txtPath = path.join(rootPath, "material.txt");
        fs.writeFileSync(txtPath, documentText);

        // write the manifest json in the file
        const jsonPath = path.join(rootPath, "manifest.json");
        fs.writeFileSync(jsonPath, JSON.stringify(options));

        // create a zip file containing the material and manifest
        const documentPackagePath = path.join(rootPath, "document-package.zip");
        const documentPackage = fs.createWriteStream(documentPackagePath);
        const archive = archiver("zip", { zlip: { level: 0 } });

        // good practice to catch warnings (ie stat failures and other non-blocking errors)
        archive.on("warning", (error: Error) => {
            console.log(error.toString());
        });

        // pipe archive data to the file
        archive.pipe(documentPackage);
        archive.file(txtPath, { name: "material.txt" });


        let response: Interfaces.ITTPIngestNewResponse;
        try {
            await archive.finalize();
            response = await this._postRequest("/ingest/new", {
                json: fs.createReadStream(jsonPath),
                pkg: fs.createReadStream(documentPackagePath)
            }, {
                "content-type": "multipart/form-data"
            })
        } catch (error) {
            // after the request remove the zip files
            fileManager.removeFolder(rootPath);
            // log error message and store the not completed material
            this.set(message, this._documentErrorPath, `${this._prefix} ${error.message}`);
            return await this._onEmit(message, "stream_error");
        }

        // get the TTP ingest response attributes
        const { rcode, id } = response;
        // after the request remove the zip files
        fileManager.removeFolder(rootPath);

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
            const transcriptions = { };

            // iterate through all responses
            for (let langId = 0; langId < languages.length; langId++) {
                // get current language
                const lang = languages[langId];
                // placeholder for transcriptions
                const transcription: { plain?: string } = { };
                for (let formatId = 0; formatId < formats.length; formatId++) {
                    const format = this._ttpFormats[formats[formatId]];
                    const index = langId * formats.length + formatId;
                    try {
                        // if the response can be parsed, it contains the error object
                        // otherwise, it is the string containing the transcriptions
                        JSON.parse(translations[index]);
                    } catch (err) {
                        // the response is a text file: dfxp, webvtt or plain
                        if (typeof translations[index] === "string") {
                            transcription[format] = translations[index];
                        }
                    }
                }
                // possible that the transcription object does not contain any data
                if (Object.keys(transcription)) {
                    // save transcriptions under the given language
                    transcriptions[lang] = transcription;
                }
            }

            // add the original language content
            transcriptions[documentLanguage] = {
                plain: documentText
            };

            // save transcriptions into the material"s metadata field
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

const create = () => {
    return new ExtractTextTTP();
}

export { create };
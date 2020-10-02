// interfaces
import * as INT from "../../Interfaces";

// modules
import BasicBolt from "./basic-bolt";
import * as fs from "fs";
import * as path from "path";
import got from "got";

import { PDFImage } from "pdf-image";
import * as Tesseract from "tesseract.js";

import Languages from "../../library/languages";
import * as fileManager from "../../library/file-manager";

class OcrBolt extends BasicBolt {

    private _documentLocationPath: string;
    private _documentLocationType: string;
    private _documentLanguagePath: string;
    private _documentOCRPath: string;
    private _OCRVerbose: boolean;
    private _documentErrorPath: string;
    private _OCRDataFolder: string;
    private _temporaryFolder: string;
    private _languages: Languages;

    constructor() {
        super();
        this._name = null;
        this._onEmit = null;
        this._context = null;
    }

    // initialize the bolt
    async init(name: string, config: INT.IOcrBoltConfig, context: any) {
        this._name = name;
        this._context = context;
        this._onEmit = config.onEmit;
        this._prefix = `[OcrBolt ${this._name}]`;

        // the path to where to get the url
        this._documentLocationPath = config.document_location_path;
        // the method type is used to extract the content
        this._documentLocationType = config.document_location_type || "remote";
        // the path to where to get the language
        this._documentLanguagePath = config.document_language_path;
        // the path to where to store the pdf output
        this._documentOCRPath = config.document_ocr_path;
        // the path to the OCR data folder
        this._OCRDataFolder = config.ocr_data_folder || "../data/ocr-data";
        fileManager.createDirectoryPath(this._OCRDataFolder);
        // setting if the component outputs OCR logs
        this._OCRVerbose = config.ocr_verbose || false;
        // the path to where to store the error
        this._documentErrorPath = config.document_error_path || "error";
        // the location of the temporary folder
        this._temporaryFolder = config.temporary_folder;
        fileManager.createDirectoryPath(this._temporaryFolder);
        // the languages mappings
        this._languages = new Languages();
    }

    heartbeat() {
        // do something if needed
    }

    async shutdown() {
        // prepare for graceful shutdown, e.g. save state
    }

    // receive the message and use OCR to extract the content
    async receive(message: any, stream_id: string) {

        try {
            const documentURL: string = this.get(message, this._documentLocationPath);
            const documentLang: string = this.get(message, this._documentLanguagePath);
            // get the alpha3 language code
            const alpha3Language = this._languages.getIsoCode(documentLang, INT.ILanguageTypes.ALPHA3);
            // get the material data as a buffer
            let dataBuffer: Buffer;
            switch(this._documentLocationType) {
            case "local":
                dataBuffer = fs.readFileSync(documentURL);
                break;
            case "remote":
            default:
                dataBuffer = (await got(documentURL)).rawBody;
                break;
            }
            // save the file temporarily
            const filePath = await this.saveTempFile(dataBuffer);
            // generate the images out of the given PDF
            const imagePaths = await this.convertToImage(filePath);
            // create the base name for the images
            const tIB = filePath.split("."); tIB.pop();
            const imageBase = tIB.join(".");
            // extract the text from the images
            const ocrTexts = [];
            for (let i = 0; i < imagePaths.length; i++) {
                const imagePath = `${imageBase}-${i}.png`;
                const text = await this.recognizeText(imagePath, alpha3Language);
                ocrTexts.push(text);
            }
            // cleanup the temporary files
            this.cleanupFiles([filePath].concat(imagePaths));
            // join the OCR extracted texts
            const ocr = ocrTexts.join(" ");
            // save the ocr metadata in the message
            this.set(message, this._documentOCRPath, ocr);
            return await this._onEmit(message, stream_id);
        } catch (error) {
            const errorMessage = `${this._prefix} Not able to extract OCR data: ${error.message}`;
            this.set(message, this._documentErrorPath, errorMessage);
            return await this._onEmit(message, "stream_error");
        }
    }

    // save the file and return the file path
    saveTempFile(fileBuffer: Buffer, extension: string = "pdf") {
        return new Promise<string>((resolve, reject) => {
            try {
                const filePath = path.join(this._temporaryFolder, `${Math.random().toString().substring(2)}T${Date.now()}.${extension}`);
                fs.writeFileSync(filePath, fileBuffer);
                return resolve(filePath);
            } catch (error) {
                return reject(error);
            }
        });
    }

    // convert the pdf file into images and returns the image paths
    async convertToImage(filePath: string): Promise<string[]> {
        const pdfImage = new PDFImage(filePath, {
            graphicsMagick: true
        });
        return await pdfImage.convertFile();
    }

    // use tesseract to recognize the text from the images
    async recognizeText(imagePath: string, lang: string): Promise<string> {
        const tOptions = {
            ...this._OCRVerbose && { logger: (m: any) => console.log(m) },
            cachePath: this._OCRDataFolder
        };
        const { data: { text } } = await Tesseract.recognize(imagePath, lang, tOptions);
        return text;
    }

    // cleanup the temporary files
    cleanupFiles(filePaths: string[]) {
        for (const filePath of filePaths) {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
    }

}

// create a new instance of the bolt
const create = () => new OcrBolt();

export { create };
// interfaces
import * as INT from "../../Interfaces";

// modules
import BasicBolt from "./basic_bolt";
import * as fs from "fs";
import * as pdf from "pdf-parse";
import got from "got";
// used for converting text documents into pdfs
import libre = require("libreoffice-convert");

class PdfBolt extends BasicBolt {

    private _documentLocationPath: string;
    private _documentLocationType: string;
    private _documentPdfPath: string;
    private _documentErrorPath: string;
    private _PDFextractMetadata: INT.IPdfMetadata[];
    private _convertToPDF: boolean;
    private _PDFtrimText: boolean;

    constructor() {
        super();
        this._name = null;
        this._onEmit = null;
        this._context = null;
    }

    // initialize the bolt
    async init(name: string, config: INT.IPdfBoltConfig, context: any) {
        this._name = name;
        this._context = context;
        this._onEmit = config.onEmit;
        this._prefix = `[PdfBolt ${this._name}]`;

        // the path to where to get the url
        this._documentLocationPath = config.document_location_path;
        // the method type is used to extract the content
        this._documentLocationType = config.document_location_type || "remote";
        // the path to where to store the pdf output
        this._documentPdfPath = config.document_pdf_path;
        // the path to where to store the error
        this._documentErrorPath = config.document_error_path || "error";
        // the extraction types
        this._PDFextractMetadata = config.pdf_extract_metadata || [
            INT.IPdfMetadata.PAGES,
            INT.IPdfMetadata.INFO,
            INT.IPdfMetadata.METADATA,
            INT.IPdfMetadata.TEXT
        ];
        // the trim PDF text
        this._PDFtrimText = config.pdf_trim_text || false;
        // the convert to PDF flag, requires libreoffice
        this._convertToPDF = config.convert_to_pdf || false;
    }

    heartbeat() {
        // do something if needed
    }

    async shutdown() {
        // prepare for graceful shutdown, e.g. save state
    }

    // receive the message and extract the pdf content
    async receive(message: any, stream_id: string) {

        try {
            const documentURL: string = this.get(message, this._documentLocationPath);
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
            // convert the document if requested
            if (this._convertToPDF && !documentURL.includes(".pdf")) {
                dataBuffer = await this.convertFile(dataBuffer, "pdf");
            }
            // get the pdf metadata
            const pdfMeta = await pdf(dataBuffer);

            const metadata = {};
            for (const type of this._PDFextractMetadata) {
                switch (type) {
                case INT.IPdfMetadata.PAGES:
                    metadata[type] = pdfMeta.numpages;
                    break;
                case INT.IPdfMetadata.INFO:
                    metadata[type] = pdfMeta.info;
                    break;
                case INT.IPdfMetadata.METADATA:
                    metadata[type] = pdfMeta.metadata;
                    break;
                case INT.IPdfMetadata.TEXT:
                    metadata[type] = this._PDFtrimText
                        ? pdfMeta.text.trim()
                        : pdfMeta.text;
                    break;
                default:
                    break;
                }
            }
            // save the pdf metadata in the message
            this.set(message, this._documentPdfPath, metadata);
            return await this._onEmit(message, stream_id);
        } catch (error) {
            const errorMessage = `${this._prefix} Not able to extract pdf data: ${error.message}`;
            this.set(message, this._documentErrorPath, errorMessage);
            return await this._onEmit(message, "stream_error");
        }
    }

    // converts the file to the designated extension
    convertFile(fileBuffer: Buffer, extension: string) {
        return new Promise<Buffer>((resolve, reject) => {
            libre.convert(fileBuffer, extension, undefined, (error: Error, convBuffer: Buffer) => {
                if (error) { return reject(error); }
                return resolve(convBuffer);
            });
        });
    }
}

// create a new instance of the bolt
const create = () => new PdfBolt();

export { create };
/** **********************************************
 * Winston Logger with
 * Winston Daily Rotate File Module
 * This module creates a logger which is able
 * to log activities and rotate them by day. In
 * addition, the log files are compressed after
 * a while.
 */

// modules
import * as fs from "fs";
import * as archiver from "archiver";
import * as path from "path";
import * as fileManager from "./file-manager";
import { createLogger, format, transports, addColors } from "winston";

// daily rotate file configuration
import DailyRotateFile = require("winston-daily-rotate-file");

class Logger {

    private _folder: string;

    constructor() {
        // set log folder path
        this._folder = path.join(__dirname, "../../../logs/");
        // create log folder
        fileManager.createDirectoryPath(this._folder);
        // add colorization to console logs
        const colors = {
            info: "grey",
            warn: "yellow",
            error: "red"
        };
        addColors(colors);
    }

    // creates a daily-rotate-file transport
    _transportCreator(filename: string, dirname: string, level: string, archive: boolean) {
        if (!filename) {
            throw new Error("Parameter 'fileName' not provided");
        }

        // create daily transport
        let transport = new (DailyRotateFile)({
            filename,
            dirname,
            datePattern: "YYYY-MM-DD",
            level,
            format: format.combine(
                format.timestamp(),
                format.json()
            )
        });

        // creates the file name
        function createFilename(level: string, year: string | number, month: string | number) {
            return `${year}-${month}-${level}`;
        }

        if (archive) {
            // action on rotate event
            transport.on("rotate", (oldFilename: string, newFilename: string) => {
                // get dates of the filenames
                const oldDate = oldFilename.split(".")[1].split("-");
                const newDate = newFilename.split(".")[1].split("-");
                // create a folder to store the old files (format: YYYY-MM)
                const monthFolderPath = path.join(dirname, createFilename(level, oldDate[0], oldDate[1]));
                fileManager.createFolder(monthFolderPath);

                // move old file to the corresponding folder
                fileManager.moveFile(oldFilename, path.join(monthFolderPath, path.basename(oldFilename)));

                // if the months don't match; archive second-to-last month folder
                if (oldDate[1] !== newDate[1]) {
                    // get second-to-last month and year
                    let tempMonth = parseInt(oldDate[1], 10) - 1;

                    const prevMonth = tempMonth === 0 ? 12 : tempMonth;
                    const prevYear = prevMonth === 12 ? parseInt(oldDate[0], 10) - 1 : parseInt(oldDate[0], 10);

                    // check if the second-to-last month folder exists
                    const prevFolderPath = path.join(dirname, createFilename(level, prevYear, (`0${prevMonth}`).slice(-2)));

                    if (fs.existsSync(prevFolderPath)) {
                        // archive second-to-last log folders
                        // only the current and previous month logs are not archived
                        const output = fs.createWriteStream(`${prevFolderPath}.tar.gz`);

                        // zip up the archive folders
                        let archive = archiver("tar", {
                            gzip: true,
                            gzipOptions: { level: 9 } // set the compression level
                        });

                        // set the output of the arhive
                        archive.pipe(output);

                        // append files from the directory
                        archive.directory(prevFolderPath, false);
                        // finalize the archive and remove the original folder
                        archive.finalize()
                            .then(() => { fileManager.removeFolder(prevFolderPath); });
                    }
                }
            });
        }
        return transport;
    }


    // creates a logger instance
    createInstance(filename: string, level="info", subFolder="", consoleFlag=true, archive=false) {
        let logger_transports = [];
        // initialize folder path and create it
        let dirname = path.join(this._folder, subFolder);
        fileManager.createDirectoryPath(dirname);
        // add console logging transport to the instance
        if (consoleFlag) {
            logger_transports.push(new transports.Console({
                level,
                format: format.combine(
                    format.colorize(),
                    format.simple(),
                    format.timestamp()
                )
            }));
        }
        // add a file rotation transport
        logger_transports.push(this._transportCreator(filename, dirname, level, archive));
        // create a logger instance
        let logger = createLogger({
            transports: logger_transports
        });
        // create a logger instance and return it
        return logger;
    }


    // create a logger instance that write in three different files: `info`, `warn` and `error`
    createGroupInstance(filename: string, subFolder="", consoleFlag=true, archive=false) {
        let logger_transports = [];
        // initialize folder path and create it
        let dirname = path.join(this._folder, subFolder);
        fileManager.createDirectoryPath(dirname);
        // add console logging transport to the instance
        if (consoleFlag) {
            logger_transports.push(new transports.Console({
                format: format.combine(
                    format.colorize(),
                    format.simple(),
                    format.timestamp()
                )
            }));
        }
        // add a file rotation transport for `info`, `warn` and `error`
        logger_transports.push(this._transportCreator(`${filename}-info`, dirname, "info", archive));
        logger_transports.push(this._transportCreator(`${filename}-warn`, dirname, "warn", archive));
        logger_transports.push(this._transportCreator(`${filename}-error`, dirname, "error", archive));
        // create a logger instance
        let logger = createLogger({
            transports: logger_transports
        });
        // create a logger instance and return it
        return logger;
    }
}

// export the factory class
export default new Logger();
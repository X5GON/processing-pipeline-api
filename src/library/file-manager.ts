/**
 * File System Module
 * This module contains methods for manipulating
 * with files and folders.
 */

// internal modules
import * as fs from "fs";
import * as path from "path";
import * as Interfaces from "../Interfaces";

// removes the file
export function removeFile(fileName: string) {
    // check if file exists
    if (fs.existsSync(fileName)) {
        fs.unlinkSync(fileName);
        return true;
    } else {
        return false;
    }
};

// moves the file
export function moveFile(oldPath: string, newPath: string) {
    // check if file exists
    if (fs.existsSync(oldPath)) {
        // move the file to other folder
        fs.renameSync(oldPath, newPath);
        return true;
    } else {
        return false;
    }
};

// Removes the folder and it's contents
export function removeFolder(sourcePath: string) {
    if (!fs.existsSync(sourcePath)) { return false; }

    const source = path.resolve(sourcePath);
    // ensure to clean up the database after the tests
    if (fs.existsSync(source)) {
        // get all file names in the directory and iterate through them
        const files = fs.readdirSync(source);
        for (const file of files) {
            const fileName = path.join(source, file);
            const stat = fs.lstatSync(fileName);
            // check if file is a directory
            if (stat.isDirectory()) {
                // recursively remove folder
                removeFolder(fileName);
            } else {
                removeFile(fileName);
            }
        }
        // remove the folder
        fs.rmdirSync(source);
        return true;
    } else {
        // no file existing
        return false;
    }
};

// Copies the folder source to folder destination
export function copyFolder(source: string, destination: string) {
    // check if source exists
    if (!fs.existsSync(source)) {
        return false;
    }
    // check if destination exists
    if (!fs.existsSync(destination)) {
        return createDirectoryPath(destination);
    }
    // get all file names in the directory and iterate through them
    const files = fs.readdirSync(source);
    for (const file of files) {
        const fileName = path.join(source, file);
        const destinationFileName = path.join(destination, file);
        const stat = fs.lstatSync(fileName);
        // check if file is a directory
        if (stat.isDirectory()) {
            // recursive check if it contains files
            return copyFolder(fileName, destinationFileName);
        } else {
            const readFile = fs.createReadStream(fileName);
            const writeFile = fs.createWriteStream(destinationFileName);
            readFile.pipe(writeFile);
        }
    }
    return true;
};

// creates a directory
export function createFolder(dirPath: string) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath);
        return true;
    }
    return false;
};

// creates all directories in path
export function createDirectoryPath(dirPath: string) {
    // resolve path
    const resolvedPath = path.resolve(dirPath);
    // split to get it's directories
    const directories = resolvedPath.split(/[\/\\]/g);
    let currentDir = directories[0].length ? directories[0] : "/";
    // add and create directories in path
    for (let i = 1; i < directories.length; i++) {
        currentDir = path.join(currentDir, directories[i]);
        createFolder(currentDir);
    }
    return true;
};


// find all files in a folder that follow a given rule and execute a method on them
export function executeOnFiles (startPath: string, filter: RegExp, callback: Interfaces.IGenericExecFunc) {
    // check if directory exists
    if (!fs.existsSync(startPath)) {
        throw new Error(`directory given by "startPath" does not exist: ${startPath}`);
    }
    // get all file names and iterate through
    const files = fs.readdirSync(startPath);
    for (const file of files) {
        const filename = path.join(startPath, file);
        const stat = fs.lstatSync(filename);

        // check if file is a directory
        if (stat.isDirectory()) {
            // recursive check if it contains files
            executeOnFiles(filename, filter, callback);
        } else if (file.match(filter)) {
            // if file name matches the filter execute callback
            callback(filename);
        }
    }
};

// return the content of the given file
export function getFileContent (filePath: string) {
    // check if file exists
    if (!fs.existsSync(filePath)) {
        throw Error(`file does not exist: ${filePath}`);
    }
    // read the file and return it's content
    return fs.readFileSync(filePath, "utf8");
};

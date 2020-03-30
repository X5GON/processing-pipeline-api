"use strict";
/**
 * Output the basic bolt template.
 */
Object.defineProperty(exports, "__esModule", { value: true });
class BasicBolt {
    constructor() {
        this._name = null;
        this._onEmit = null;
        this._context = null;
    }
    init(name, config, context, callback) {
        // create sometyhing if needed
        callback();
    }
    heartbeat() {
        // do something if needed
    }
    shutdown(callback) {
        // prepare for gracefull shutdown, e.g. save state
        callback();
    }
    // extracts the data from the object
    get(object, path) {
        let schema = object;
        let pathList = path.split(".");
        for (let val of pathList) {
            schema = schema[val];
            // if there is nothing return null
            if (!schema) {
                return null;
            }
        }
        return schema;
    }
    /**
     * @description Sets the value from the object.
     * @param {Object} object - The object from which we wish to set value.
     * @param {String} [path] - The path of the value to be assigned.
     * @param {Object} value - The value to be assigned.
     */
    set(object, path, value) {
        if (!path) {
            return;
        }
        let schema = object;
        let pathList = path.split(".");
        let pathLength = pathList.length;
        for (let i = 0; i < pathLength - 1; i++) {
            let el = pathList[i];
            if (!schema[el]) {
                schema[el] = {};
            }
            schema = schema[el];
        }
        schema[pathList[pathLength - 1]] = value;
    }
    receive(data, stream_id, callback) {
        // do something
        callback();
    }
}
exports.default = BasicBolt;

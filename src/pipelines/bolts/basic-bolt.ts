/**
 * Output the basic bolt template.
 */

import { SimpleCallback, BoltEmitCallback } from "qtopology";


export default class BasicBolt {

    protected _name: string;
    protected _onEmit: BoltEmitCallback;
    protected _context: any;
    protected _prefix: string;

    constructor() {
        this._name = null;
        this._onEmit = null;
        this._context = null;
    }

    init(name: string, config: any, context: any, callback: SimpleCallback) {
        // create sometyhing if needed
        callback();
    }

    heartbeat() {
        // do something if needed
    }

    shutdown(callback: SimpleCallback) {
        // prepare for gracefull shutdown, e.g. save state
        callback();
    }

    // extracts the data from the object
    get(object: any, path: string) {
        let schema = object;
        let pathList = path.split(".");
        for (let val of pathList) {
            schema = schema[val];
            // if there is nothing return null
            if (!schema) { return null; }
        }
        return schema;
    }

    /**
     * @description Sets the value from the object.
     * @param {Object} object - The object from which we wish to set value.
     * @param {String} [path] - The path of the value to be assigned.
     * @param {Object} value - The value to be assigned.
     */
    set(object: any, path: string, value: any) {
        if (!path) { return; }
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


    receive(data: any, stream_id: string, callback: SimpleCallback) {
        // do something
        callback();
    }
}

/**
 * Output the basic bolt template.
 */

import * as qtopology from "qtopology";


export default class BasicBolt {

    protected _name: string;
    protected _onEmit: qtopology.BoltEmitCallbackAsync;
    protected _context: any;
    protected _prefix: string;

    constructor() {
        this._name = null;
        this._onEmit = null;
        this._context = null;
    }

    async init(name: string, config: any, context: any) {
        // create something if needed
    }

    heartbeat() {
        // do something if needed
    }

    async shutdown() {
        // prepare for graceful shutdown, e.g. save state
    }

    // extracts the data from the object
    get(object: any, path: string) {
        let schema = object;
        const pathList = path.split(".");
        for (const val of pathList) {
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
        const pathList = path.split(".");
        const pathLength = pathList.length;
        for (let i = 0; i < pathLength - 1; i++) {
            const el = pathList[i];
            if (!schema[el]) {
                schema[el] = {};
            }
            schema = schema[el];
        }
        schema[pathList[pathLength - 1]] = value;
    }

    async receive(data: any, stream_id: string) {
        // do something
    }
}

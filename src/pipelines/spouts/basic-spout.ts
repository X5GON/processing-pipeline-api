

import * as qtopology from "qtopology";

export default class BasicSpout {

    protected _name: string;
    protected _context: any;
    protected _prefix: string;

    constructor() {
        this._name = null;
        this._context = null;
        this._prefix = "";
    }

    init(name: string, config: any, context: any, callback: qtopology.SimpleCallback) {
        // create something if needed
        callback();
    }

    heartbeat() {
        // do something if needed
    }

    shutdown(callback: qtopology.SimpleCallback) {
        // prepare the graceful shutdown, e.g. save state
        callback();
    }

    run() { }

    pause() { }

    next(callback: qtopology.SimpleCallback) {
        // do something
        callback();
    }
}
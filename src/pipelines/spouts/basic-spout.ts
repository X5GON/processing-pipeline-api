
export default class BasicSpout {

    protected _name: string;
    protected _context: any;
    protected _prefix: string;

    constructor() {
        this._name = null;
        this._context = null;
        this._prefix = "";
    }

    async init(name: string, config: any, context: any) {
        // create something if needed
    }

    heartbeat() {
        // do something if needed
    }

    async shutdown() {
        // prepare the graceful shutdown, e.g. save state
    }

    run() {
        // do something if needed
    }

    pause() {
        // do something if needed
    }

    async next(): Promise<{ data: any }> {
        // do something
        return new Promise((resolve, reject) => {
            resolve({ data: null });
        })
    }
}
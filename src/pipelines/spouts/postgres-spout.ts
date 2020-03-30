// interfaces
import * as qtopology from "qtopology";
import * as Interfaces from "../../Interfaces";

// modules
import BasicSpout from "./basic-spout";
import PostgreSQL from "../../library/postgresQL";

class PostgresRecords {

    private _data: any[];
    private _pg: PostgreSQL;
    private _sqlStatement: string;
    private _timeInterval: number;
    private _interval: NodeJS.Timeout;

    constructor(config: Interfaces.IPostgreSQLParams, SQL_statement: string, time_interval: number) {
        // the record container
        this._data = [];
        // esablish connection with database
        this._pg = new PostgreSQL(config);
        // store the SQL statement for future use
        this._sqlStatement = SQL_statement;
        // store the interval value for continuous retrieval
        this._timeInterval = time_interval;
        // the interval object
        this._interval = null;
    }

    enable() {
        // enable postgresql collection
        if (!this._interval) {
            this._interval = setInterval(() => {
                this._getMaterialMetadata();
            }, this._timeInterval);
            this._getMaterialMetadata();
        }
    }

    disable() {
        // disable postgresql collection
        if (this._interval) {
            clearInterval(this._interval);
        }
    }

    next() {
        // get next data record
        if (this._data.length > 0) {
            let record = this._data[0];
            this._data = this._data.splice(1);
            return record;
        } else {
            return null;
        }
    }

    stop(callback: qtopology.SimpleCallback) {
        // disable interval
        this.disable();
        // close pg connection
        this._pg.close().then(() => { callback(); });
    }


    _getMaterialMetadata() {
        const records = await this._pg.execute(this._sqlStatement, []);
        records.forEach((record) => {
            this._data.push(record);
        });
    }
}


/**
 * @class PostgresqlSpout
 * @description Periodically retrieves the records from the postgreql table
 * and sends it to the
 */
class PostgresqlSpout extends BasicSpout {

    private _generator: PostgresRecords;

    constructor() {
        super();
        this._name = null;
        this._context = null;
        this._prefix = "";
        this._generator = null;
    }

    init(name: string, config: any, context: any, callback: qtopology.SimpleCallback) {
        this._name = name;
        this._context = context;
        this._prefix = `[PostgresqlSpout ${this._name}]`;
        this._generator = new PostgresRecords(
            config.pg,
            config.sql_statement,
            config.time_interval
        );
        callback();
    }

    heartbeat() {
        // do something if needed
    }

    shutdown(callback: qtopology.SimpleCallback) {
        // stop postgresql generator
        this._generator.stop(callback);
    }

    run() {
        // enable postgresql generator
        this._generator.enable();
    }

    pause() {
        // disable postgresql generator
        this._generator.disable();
    }

    next(callback: qtopology.SpoutNextCallback) {
        // get the next message from the generator
        const message = this._generator.next();
        callback(null, message, null);
    }
}


const create = function () {
    return new PostgresqlSpout();
}

export { create };
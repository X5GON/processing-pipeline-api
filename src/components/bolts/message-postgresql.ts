/** ******************************************************************
 * Logging Message to PostgresQL
 * This component receives the message and logs the status into
 * the provided PostgreSQL table (with the provided attributes).
 */

// interfaces
import * as Interfaces from "../../Interfaces";

// modules
import BasicBolt from "./basic-bolt";
import PostgreSQL from "../../library/postgresQL";

class MessagePostgreSQL extends BasicBolt {

    private _pg: PostgreSQL;
    private _postgresTable: string;
    private _postgresMethod: string;
    private _postgresPrimaryId: string;
    private _messagePrimaryId: string;

    private _postgresMessageAttrs: Interfaces.IGenericJSON;
    private _postgresTimeAttrs: Interfaces.IGenericJSON;
    private _postgresLiteralAttrs: Interfaces.IGenericJSON;

    private _finalBolt: boolean;

    private _documentErrorPath: string;


    constructor() {
        super();
        this._name = null;
        this._onEmit = null;
        this._context = null;
    }

    async init(name: string, config: Interfaces.IMessagePostgreSQLConfig, context: any) {
        this._name = name;
        this._context = context;
        this._onEmit = config.onEmit;
        this._prefix = `[StorePostgreSQL ${this._name}]`;

        // create the postgres connection
        this._pg = new PostgreSQL(config.pg);

        this._postgresTable = config.postgres_table;
        this._postgresMethod = config.postgres_method || "update";
        this._postgresPrimaryId = config.postgres_primary_id;
        this._messagePrimaryId = config.message_primary_id;

        this._postgresMessageAttrs = config.postgres_message_attrs || null;
        this._postgresTimeAttrs = config.postgres_time_attrs || null;
        this._postgresLiteralAttrs = config.postgres_literal_attrs || null;

        this._finalBolt = config.final_bolt || false;

        // the path to where to store the error
        this._documentErrorPath = config.document_error_path || "error";
    }

    heartbeat() {
        // do something if needed
    }

    async shutdown() {
        if (this._pg) {
            // prepare for graceful shutdown, e.g. save state
            await this._pg.close();
        }
    }

    async receive(message: any, stream_id: string) {

        // /////////////////////////////////////////
        // PREPARE THE UPDATE AND PRIMARY ATTRS
        // /////////////////////////////////////////

        const primaryAttrs = {
            [this._postgresPrimaryId]: this.get(message, this._messagePrimaryId)
        };

        // add the primary key to the update attributes (required to update the records)
        const updateAttrs = {
            [this._postgresPrimaryId]: this.get(message, this._messagePrimaryId)
        };

        if (this._postgresMessageAttrs) {
            // populate the update attributes with the message values
            for (const attr of Object.keys(this._postgresMessageAttrs)) {
                updateAttrs[attr] = this.get(message, this._postgresMessageAttrs[attr]);
            }
        }

        if (this._postgresTimeAttrs) {
            // populate the update attributes with the given time values
            for (const time of Object.keys(this._postgresTimeAttrs)) {
                updateAttrs[time] = (new Date()).toISOString();
            }
        }

        if (this._postgresLiteralAttrs) {
            // populate the update attributes with the given values
            for (const attr of Object.keys(this._postgresLiteralAttrs)) {
                updateAttrs[attr] = this._postgresLiteralAttrs[attr];
            }
        }

        // /////////////////////////////////////////
        // UPDATE THE RECORD
        // /////////////////////////////////////////

        // update the record attributes with the given attributes
        let streamID = stream_id;
        try {
            await this._pg[this._postgresMethod](updateAttrs, primaryAttrs, this._postgresTable);
        } catch (error) {
            // update the message with the error
            this.set(message, this._documentErrorPath, error.message);
            streamID = "stream_error";
        }
        // if this is the final bolt
        if (this._finalBolt) { return; }
        // otherwise continue with the stream
        return await this._onEmit(message, streamID);
    }
}

// create a new instance of the bolt
const create = () => new MessagePostgreSQL();

export { create };


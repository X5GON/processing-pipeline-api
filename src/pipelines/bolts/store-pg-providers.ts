/** ******************************************************************
 * PostgresQL storage process for user activity data
 * This component receives the verified OER material object and
 * stores it into postgresQL database.
 */

// interfaces
import * as Interfaces from "../../Interfaces";

// modules
import BasicBolt from "./basic-bolt";
import PostgreSQL from "../../library/postgresQL";

class StoreProviders extends BasicBolt {

    private _pg: PostgreSQL;

    constructor() {
        super();
        this._name = null;
        this._onEmit = null;
        this._context = null;
    }

    async init(name: string, config: Interfaces.IStoreConfig, context: any) {
        this._name = name;
        this._context = context;
        this._onEmit = config.onEmit;
        this._prefix = `[StoreProviders ${this._name}]`;
        // create the postgres connection
        this._pg = new PostgreSQL(config.pg);
    }

    heartbeat() {
        // do something if needed
    }

    async shutdown() {
        // close connection to postgres database
        await this._pg.close();
    }

    async receive(message: any, stream_id: string) {
        // get sent values
        const {
            name,
            domain,
            contact,
            token
        } = message;

        try {
            await this._pg.upsert({ name, domain, contact, token }, { token: null }, "providers");
        } catch (error) {
            // error handling
        }
    }
}

// create a new instance of the bolt
const create = () => new StoreProviders();

export { create };

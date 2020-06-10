/** **********************************************
 * PostgresQL Module
 * This module connect to the PostgresQL database
 * and allows execution of simple commands.
 */

// interfaces
import * as Interfaces from "../Interfaces";

// modules
import * as pg from "pg";
import * as Cursor from "pg-cursor";
import * as async from "async";


export default class PostgreSQL {

    private _config: Interfaces.IPostgreSQLParams;
    private _pool: pg.Pool;

    // initialize postgresql connection instance
    constructor(config: Interfaces.IPostgreSQLParams) {
        // save the configuration file
        this._config = config;
        // initilizes client pool
        this._initializePool();
    }


    // closes the connections
    async close() {
        return await this._pool.end();
    }


    // initialize pool and establish connections
    _initializePool() {
        // create a pool of connections
        this._pool = new pg.Pool(this._config);
        // put event handler
        this._pool.on("error", (error, client) => {
            // how to handle errors of the idle clients
            console.error("idle client error", error.message, error.stack);
            // TODO: expect the client - find a possible reason for exit
        });
    }


    // extracts the keys and values for querying
    _extractKeysAndValues(params: any[], idx: number) {
        // prepare query and params
        const keys: string[] = [];
        const values: string[] = [];

        // iterate thorugh the parameters
        for (const key of Object.keys(params)) {
            // check if key-value is object
            if (params[key] instanceof Object) {
                // iterate through the object keys to create a query
                for (const kkey of Object.keys(params[key])) {
                    keys.push(`${key}->>'${kkey}'=$${idx}`); idx++;
                    values.push(params[key][kkey]);
                }
            } else {
                // the key-values are primary values
                keys.push(`${key}=$${idx}`); idx++;
                values.push(params[key]);
            }
        }
        // return the key-values
        return { keys, values, idx };
    }


    // extracts the condition rules
    _constructCondition(whereParams: any | any[], idx: number) {
        let condition: string;
        let params: string[] = [];
        if (whereParams instanceof Array) {
            // get all conditions together
            const conditionKeys: string[] = [];
            for (const cond of whereParams) {
                // extract the conditions and values, concat in an array
                const { keys, values, idx: index } = this._extractKeysAndValues(cond, idx);
                conditionKeys.push(`(${keys.join(" AND ")})`);
                params = params.concat(values);
                idx = index;
            }
            // join the conditions
            condition = conditionKeys.join(" OR ");
        } else {
            const { keys, values, idx: index } = this._extractKeysAndValues(whereParams, idx);
            // join the conditions and prepare the params
            condition = keys.join(" AND ");
            params = params.concat(values);
            idx = index;
        }
        return { condition, params, idx };
    }


    // gets the condition keys and values
    _getConditionKeysAndValues(values: { [key: string]: string | number }, idx: number) {
        // prepare query and params
        const condition: string[] = [];
        const params: (string | number)[] = [];

        for (const key of Object.keys(values)) {
            // the key-values are primary values
            condition.push(`${key}=$${idx}`); idx++;
            params.push(values[key]);
        }
        // return the key-values and the index
        return { condition, params, idx };
    }


    // execute the query
    async execute(statement: string, params: any[]) {
        const client = await this._pool.connect();
        // execute the statement
        let results: pg.QueryResult;
        try {
            // execute statement
            if (params.length === 0) {
                results = await client.query(statement);
            } else {
                results = await client.query(statement, params);
            }
        } catch (error) {
            // release the client
            client.release();
            throw error;
        }
        // release the client
        client.release();
        return results ? results.rows : [];
    }


    // executes a large query given the values
    async executeLarge(statement: string, params: any[], batchSize: number, batchCallback: Interfaces.IPostgreSQLBatchCallbackFunc, callback: Interfaces.IGenericCallbackFunc) {
        const client = await this._pool.connect();
        // create a cursor (with or without the parameters provided)
        const cursor = params.length
            ? client.query(new Cursor(statement, params))
            : client.query(new Cursor(statement));

        let lastBatch = batchSize;
        // This function designates what to do with the values read by the cursor.
        function _batchFunction(xcallback: (param: any) => any) {
            cursor.read(batchSize, (xerror: Error, rows: any[]) => {
                if (xerror) {
                    lastBatch = 0;
                    return xcallback(xerror);
                } else {
                    lastBatch = rows.length;
                    // activate the batch callback function
                    return batchCallback(null, rows, xcallback);
                }
            });
        }
        // what to do when all of the batches were processed
        function _batchFinalFunction(error: Error) {
            cursor.close(() => {
                client.release();
                return callback(error);
            });
        }
        // start processing records in postgres
        async.whilst(
            () => batchSize === lastBatch,
            _batchFunction,
            _batchFinalFunction
        );
    }


    // inserts the object in the database
    async insert(record: Interfaces.IGenericJSON, table: string) {
        // get the record keys and values
        const keys: string[] = [];
        const params: any[] = [];
        // populate key and params arrays
        Object.entries(record).forEach((value) => {
            keys.push(value[0]);
            params.push(value[1]);
        });
        // prepare the query command
        const recordValIds = [...Array(keys.length).keys()]
            .map((id) => `$${id + 1}`)
            .join(",");

        const query = `
            INSERT INTO ${table} (${keys.join(",")}) VALUES (${recordValIds})
            RETURNING *;
        `;
        // execute the query
        return await this.execute(query, params);
    }


    // finds the rows in the database
    async select(conditions: any | any[], table: string) {
        // set the conditions and parameters
        const { condition, params } = this._constructCondition(conditions, 1);
        // prepare the query command
        const query = params.length
            ? `SELECT * FROM ${table} WHERE ${condition};`
            : `SELECT * FROM ${table};`;
        // execute the query
        return await this.execute(query, params);
    }


    // fins the rows in the database (large version)
    selectLarge(conditions: any | any[], table: string, batchSize: number, batchCallback: Interfaces.IPostgreSQLBatchCallbackFunc, callback: Interfaces.IGenericCallbackFunc) {
        // set the conditions and parameters
        const { condition, params } = this._constructCondition(conditions, 1);
        // prepare the query command
        const query = params.length
            ? `SELECT * FROM ${table} WHERE ${condition};`
            : `SELECT * FROM ${table};`;
        // execute the query
        this.executeLarge(query, params, batchSize, batchCallback, callback);
    }


    // count the number of rows in the database following some conditions
    async count(conditions: any | any[], table: string) {
        // set the conditions and parameters
        const { condition, params } = this._constructCondition(conditions, 1);
        // prepare the query command
        const query = params.length
            ? `SELECT COUNT(*) FROM ${table} WHERE ${condition};`
            : `SELECT COUNT(*) FROM ${table};`;
        // execute the query
        return await this.execute(query, params);
    }


    // update the rows in the database
    async update(values: Interfaces.IGenericJSON, conditions: any | any[], table: string) {
        // get the values used to update the records
        const {
            condition: valueConditions,
            params: valueParams,
            idx
        } = this._getConditionKeysAndValues(values, 1);
        // get conditions and associated values
        const { condition, params } = this._constructCondition(conditions, idx);
        // get joint parameters
        const allParams = valueParams.concat(params);
        // prepare query and params
        const query = `
            UPDATE ${table} SET ${valueConditions.join(", ")}
            ${condition.length ? `WHERE ${condition}` : ""}
            RETURNING *;
        `;
        // execute the query
        return await this.execute(query, allParams);
    }


    // deletes the rows in the database
    async delete(conditions: any | any[], table: string) {
        // get the conditions and prepare the query
        const { condition, params } = this._constructCondition(conditions, 1);
        const query = `
            DELETE FROM ${table}
            ${condition ? `WHERE ${condition}` : ""}
            RETURNING *;
        `;
        // execute the query
        return await this.execute(query, params);
    }


    // upserts (updates or inserts) the row in the database
    async upsert(record: Interfaces.IGenericJSON, conditions: any | any[], table: string) {
        // get the record keys and values
        const recordKeys = Object.keys(record);
        const recordValIds = [...Array(recordKeys.length).keys()]
            .map((id) => `$${id + 1}`).join(",");

        // get the values used to update the records
        const { condition, params } = this._getConditionKeysAndValues(record, 1);

        // get the condition keys - must be UNIQUE
        const conditionKeys = Object.keys(conditions);
        if (conditionKeys.length > 1) {
            throw new Error(`[PostgresQL upsert] Too many conditions ${conditionKeys.join(",")}`);
        }
        // create the query command
        const query = `
            INSERT INTO ${table} (${recordKeys.join(",")}) VALUES (${recordValIds})
            ON CONFLICT (${conditionKeys.join(", ")})
                DO UPDATE SET ${condition.join(", ")}
            RETURNING *;
        `;
        // execute the query
        return await this.execute(query, params);
    }
}

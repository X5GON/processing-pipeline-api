/** ******************************************************************
 * PostgresQL storage process for user activity data
 * This component receives the verified OER material object and
 * stores it into postgresQL database.
 */

// interfaces
import * as Interfaces from "../../Interfaces";
import { SimpleCallback } from "qtopology";

// modules
import BasicBolt from "./basic-bolt";
import * as PostgreSQL from "../../library/postgresQL";


class RetrieveMaterialMetadata extends BasicBolt {

    private _pg: any;
    private _documentTextPath: string;

    constructor() {
        super();
        this._name = null;
        this._onEmit = null;
        this._context = null;
    }

    init(name: string, config: Interfaces.IGetMaterialContentConfig, context: any, callback: SimpleCallback) {
        this._name = name;
        this._context = context;
        this._onEmit = config.onEmit;
        this._prefix = `[RetrieveMaterialMetadata ${this._name}]`;
        this._documentTextPath = config.document_text_path || "material_metadata.raw_text";
        // create the postgres connection
        this._pg = PostgreSQL(config.pg);
        callback();
    }

    heartbeat() {
        // do something if needed
    }

    shutdown(callback: SimpleCallback) {
        // close connection to postgres database
        this._pg.close();
        // shutdown component
        callback();
    }

    receive(material: any, stream_id: string, callback: SimpleCallback) {
        let self = this;

        const material_id: number = material.material_id;

        this._pg.select({ material_id, type: "text_extraction" }, "material_contents", (error: Error, response: any[]) => {
            if (error) { return callback(); }

            if (response.length === 0) {
                // there was no response, material does not have any text stored
                return self._onEmit(material, stream_id, callback);
            }
            // get the text value
            const {
                value: {
                    value: text
                }
            } = response[0];
            // save the text as a material attribute
            self.set(material, self._documentTextPath, text);
            // go to the next step of material processing
            return self._onEmit(material, stream_id, callback);
        });
    }
}

// create a new instance of the bolt
const create = function () {
    return new RetrieveMaterialMetadata();
};

export { create };
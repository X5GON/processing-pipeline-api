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


class RetrieveMaterialMetadata extends BasicBolt {

    private _pg: PostgreSQL;
    private _documentTextPath: string;
    private _documentErrorPath: string;

    constructor() {
        super();
        this._name = null;
        this._onEmit = null;
        this._context = null;
    }

    async init(name: string, config: Interfaces.IGetMaterialContentConfig, context: any) {
        this._name = name;
        this._context = context;
        this._onEmit = config.onEmit;
        this._prefix = `[RetrieveMaterialMetadata ${this._name}]`;
        this._documentTextPath = config.document_text_path || "material_metadata.raw_text";
        this._documentErrorPath = config.document_error_path || "error";
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

    async receive(material: any, stream_id: string) {

        const material_id: number = material.material_id;

        try {
            const response = await this._pg.select({ material_id, type: "text_extraction" }, "material_contents");
            if (response.length === 0) {
                // there was no response, material does not have any text stored
                return await this._onEmit(material, stream_id);
            }
            // get the text value
            const {
                value: {
                    value: text
                }
            } = response[0];
            // save the text as a material attribute
            this.set(material, this._documentTextPath, text);
            // go to the next step of material processing
            return await this._onEmit(material, stream_id);
        } catch (error) {
            const errorMessage = `${this._prefix} ${error.message}`;
            this.set(material, this._documentErrorPath, errorMessage);
            // go to the next step of material processing
            return await this._onEmit(material, "stream_error");
        }
    }
}

// create a new instance of the bolt
const create = () => {
    return new RetrieveMaterialMetadata();
};

export { create };
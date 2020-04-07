/** ******************************************************************
 * PostgresQL storage process for materials
 * This component receives the verified OER material object and
 * stores it into postgresQL database.
 */

// interfaces
import * as Interfaces from "../../Interfaces";

// modules
import BasicBolt from "./basic-bolt";
import PostgreSQL from "../../library/postgresQL";


class StoreMaterialComplete extends BasicBolt {

    private _pg: PostgreSQL;
    private _finalBolt: boolean;

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
        this._prefix = `[StoreMaterialComplete ${this._name}]`;

        // create the postgres connection
        this._pg = new PostgreSQL(config.pg);

        this._finalBolt = config.final_bolt || false;
    }

    heartbeat() {
        // do something if needed
    }

    async shutdown() {
        // close connection to postgres database
        await this._pg.close();
    }

    async receive(message: any, stream_id: string) {
        const {
            oer_materials,
            material_contents,
            features_public,
            urls,
            provider_token
        } = message;

        // otherwise insert the missing values
        const result = await this._pg.insert(oer_materials, "oer_materials");

        // get material id
        const material_id = result[0].id;

        // get last updated date
        const newDate = (new Date()).toISOString();

        try {
            // /////////////////////////////////////////
            // SAVE MATERIAL CONTENTS
            // /////////////////////////////////////////

            for (let material_content of material_contents) {
                material_content.material_id = material_id;
                material_content.last_updated = newDate;
                // add the task of pushing material contents
                await this._pg.insert(material_content, "material_contents");
            }

            // /////////////////////////////////////////
            // SAVE FEATURES PUBLIC
            // /////////////////////////////////////////

            features_public.record_id = material_id;
            features_public.table_name = "oer_materials";
            features_public.last_updated = newDate;

            await this._pg.insert(features_public, "features_public");

            // /////////////////////////////////////////
            // SAVE URLS
            // /////////////////////////////////////////

                // check for provider in database
            const providers = await this._pg.select({ token: provider_token }, "providers");

            const provider_id = providers.length ? providers[0].id : null;

            // set the provider id if inside the database
            let material_url = {
                url: urls.material_url,
                material_id,
                ...provider_id && { provider_id }
            };

            let provider_uri = {
                url: urls.provider_uri,
                ...provider_id && { provider_id }
            };

            // set url list
            const urlData = [
                this._pg.upsert(provider_uri, { url: null }, "urls"),
                this._pg.upsert(material_url, { url: null }, "urls")
            ];

            const urlIDs = await Promise.all(urlData);
            const providerID = urlIDs[0].length ? urlIDs[0][0].id : null;
            const materialID = urlIDs[1].length ? urlIDs[1][0].id : null;

            // insert the contains record
            await this._pg.execute(`INSERT INTO contains (container_id, contains_id) VALUES (${providerID}, ${materialID}) ON CONFLICT ON CONSTRAINT contains_pkey DO NOTHING;`, []);

            // /////////////////////////////////////////
            // RUN THE TASKS
            // /////////////////////////////////////////

            // update the message with the material id
            message.oer_materials.material_id = material_id;

            if (this._finalBolt) { return; }
            return this._onEmit(message, stream_id);
        } catch (error) { }
    }
}

// create a new instance of the bolt
const create = () => new StoreMaterialComplete();

export { create };

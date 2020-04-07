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

class StoreRecsysTransitions extends BasicBolt {

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
        this._prefix = `[StoreRecsysTransitions ${this._name}]`;

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
            from,
            to,
            uuid,
            selected_position,
            recommended_urls
        } = message;

        try {
            const fromToMaterialIDs = [
                this._pg.select({ provider_uri: from }, "rec_sys_material_model"),
                this._pg.select({ provider_uri: to }, "rec_sys_material_model")
            ];

            const materialIDs = await Promise.all(fromToMaterialIDs)

            const fromMaterialID = materialIDs[0].length ? materialIDs[0][0].id : null;
            const toMaterialID = materialIDs[1].length ? materialIDs[1][0].id : null;

            // create user transitions values
            const rec_sys_user_transitions = {
                uuid: !uuid.includes("unknown") ? uuid : null,
                from_url: from,
                to_url: to,
                from_material_model_id: fromMaterialID,
                to_material_model_id: toMaterialID,
                selected_position,
                recommended_urls,
                num_of_recommendations: recommended_urls.length
            };
            await this._pg.insert(rec_sys_user_transitions, "rec_sys_user_transitions");
        } catch (error) {
            // error handling
        }
    }
}

// create a new instance of the bolt
const create = () => new StoreRecsysTransitions();

export { create };
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


class StoreMaterialUpdate extends BasicBolt {

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
        this._prefix = `[StoreMaterialUpdate ${this._name}]`;

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
        let self = this;

        const {
            material_id,
            language: origin_language,
            material_metadata: {
                raw_text,
                transcriptions,
                wikipedia_concepts,
                ttp_id
            }
        } = message;


        const newDate = (new Date()).toISOString();

        try {
            // /////////////////////////////////////////
            // DELETE PREVIOUS CONTENTS
            // /////////////////////////////////////////

            // add the task of pushing material contents
            await this._pg.delete({ material_id }, "material_contents");

            // /////////////////////////////////////////
            // SAVE MATERIAL CONTENTS
            // /////////////////////////////////////////

            // set the material contents
            let material_contents = [];

            // prepare list of material contents
            if (transcriptions) {
                for (let language in transcriptions) {
                    for (let extension in transcriptions[language]) {
                        // get value of the language and extension
                        const value = transcriptions[language][extension];

                        // define the type of the transcriptions
                        const type = language === origin_language
                            ? "transcription"
                            : "translation";

                        material_contents.push({
                            language,
                            type,
                            extension,
                            value: { value },
                            material_id,
                            last_updated: newDate
                        });
                    }
                }
            } else if (raw_text) {
                // prepare the material content object
                material_contents.push({
                    language: origin_language,
                    type: "transcription",
                    extension: "plain",
                    value: { value: raw_text },
                    material_id,
                    last_updated: newDate
                });
            }

            for (let material_content of material_contents) {
                // add the task of pushing material contents
                await this._pg.insert(material_content, "material_contents");
            }

            // /////////////////////////////////////////
            // SAVE WIKIFIER REPRESENTATION
            // /////////////////////////////////////////

            // prepare of public feature - wikipedia concept
            let features_public = {
                name: "wikipedia_concepts",
                value: { value: wikipedia_concepts },
                re_required: true,
                record_id: material_id,
                table_name: "oer_materials",
                last_updated: newDate
            };

            await this._pg.insert(features_public, "features_public");

            // /////////////////////////////////////////
            // DELETE PREVIOUS WIKIFIER REPRESENTATION
            // /////////////////////////////////////////

            // add the task of pushing material contents
            await this._pg.execute(`DELETE FROM features_public WHERE record_id=${material_id} AND table_name='oer_materials' AND name='wikipedia_concepts' AND re_required IS TRUE AND last_updated IS NULL;`, []);

            // /////////////////////////////////////////
            // UPDATE MATERIAL RETRIEVAL DATE
            // /////////////////////////////////////////

            await this._pg.update({ retrieved_date: newDate, ttp_id }, { id: material_id }, "oer_materials");

            // /////////////////////////////////////////
            // RUN THE TASKS
            // /////////////////////////////////////////

            if (self._finalBolt) { return; }
            return await self._onEmit(message, stream_id);

        } catch (error) { }
    }
}
// create a new instance of the bolt
const create = () => new StoreMaterialUpdate();

export { create };


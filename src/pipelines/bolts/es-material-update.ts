/** ******************************************************************
 * Extract Video Transcriptions and Translations via TTP
 * This component makes a request to the UPV's Transcription and
 * Translation Platform (TTP) <https://ttp.mllp.upv.es/index.php>
 * and retrieves the video content as raw text and dfxp.]
 */

// modules
import BasicBolt from "./basic-bolt";
import PostgreSQL from "../../library/postgresQL";
import Elasticsearch from "../../library/elasticsearch";

class ElastisearchUpdate extends BasicBolt {

    private _es: Elasticsearch;
    private _pg: PostgreSQL;
    private _finalBolt: boolean;

    constructor() {
        super();
        this._name = null;
        this._context = null;
        this._onEmit = null;
    }

    async init(name: string, config: any, context: any) {
        this._name = name;
        this._context = context;
        this._onEmit = config.onEmit;
        this._prefix = `[ElastisearchUpdate ${this._name}]`;

        this._es = new Elasticsearch(config.elasticsearch);
        this._pg = new PostgreSQL(config.pg);

        this._finalBolt = config.final_bolt;
    }

    heartbeat() {
        // do something if needed
    }

    async shutdown() {
        // prepare for graceful shutdown, e.g. save state
    }


    async receive(message: any, stream_id: string) {
        const {
            material_id,
            new_date,
            material_metadata: {
                wikipedia_concepts
            }
        } = message;

        const mc = await this._pg.select({ material_id }, "material_contents");
        // set the material contents
        const contents = [];
        // prepare list of material contents
        for (const content of mc) {
            contents.push({
                content_id: content.id,
                language: content.language,
                type: content.type,
                extension: content.extension,
                value: content.value.value
            });
        }

        const wikipedia = JSON.parse(JSON.stringify(wikipedia_concepts));

        // modify the wikipedia array
        for (const value of wikipedia) {
            // rename the wikipedia concepts
            value.sec_uri = value.secUri;
            value.sec_name = value.secName;
            value.pagerank = value.pageRank;
            value.db_pedia_iri = value.dbPediaIri;
            value.support = value.supportLen;
            value.wiki_data_classes = value.wikiDataClasses;
            // delete the previous values
            delete value.secUri;
            delete value.secName;
            delete value.pageRank;
            delete value.dbPediaIri;
            delete value.supportLen;
            delete value.wikiDataClasses;
        }

        const record = {
            retrieved_date: new_date,
            contents,
            wikipedia
        };

        // update the record in the elasticsearch index
        await this._es.updateRecord("oer_materials", material_id, record);
        // refresh the elasticsearch index
        await this._es.refreshIndex("oer_materials");

        // continue with the last patching
        return this._finalBolt ? null : await this._onEmit(message, stream_id);
    }
}

const create = () => new ElastisearchUpdate();

export { create };

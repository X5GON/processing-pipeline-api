/** ******************************************************************
 * Extract Video Transcriptions and Translations via TTP
 * This component makes a request to the UPV's Transcription and
 * Translation Platform (TTP) <https://ttp.mllp.upv.es/index.php>
 * and retrieves the video content as raw text and dfxp.]
 */

// json
import * as mimetypes from "../../config/mimetypes.json";

// modules
import BasicBolt from "./basic_bolt";
import PostgreSQL from "../../library/postgresQL";
import Elasticsearch from "../../library/elasticsearch";

// default values
// set the default disclaimer parameter
const NO_LICENSE_DISCLAIMER =
  "X5GON recommends the use of the Creative Commons open licenses. During a transitory phase, other licenses, open in spirit, are sometimes used by our partner sites.";
const DEFAULT_DISCLAIMER =
  "The usage of the corresponding material is in all cases under the sole responsibility of the user.";

// returns the general material type
function materialType(mimetype: string) {
  for (const type in mimetypes) {
    if (mimetypes[type].includes(mimetype)) {
      return type;
    }
  }
  return null;
}

class ESCreateBolt extends BasicBolt {
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
    this._prefix = `[ESCreateBolt ${this._name}]`;

    this._es = new Elasticsearch(config.elasticsearch);
    this._pg = new PostgreSQL(config.pg);

    this._finalBolt = config.final_bolt;
  }

  heartbeat() {
    // do something if needed
  }

  async shutdown() {
    // prepare for gracefull shutdown, e.g. save state
  }

  async receive(message: any, stream_id: string) {
    try {
      const {
        oer_materials: {
          material_id,
          title,
          description,
          language,
          creation_date,
          retrieved_date,
          type,
          mimetype,
          license,
        },
        features_public,
        urls: { material_url, provider_uri: website_url },
        provider_token,
      } = message;

      const mc = await this._pg.select({ material_id }, "material_contents");

      const contents = [];
      for (const content of mc) {
        contents.push({
          content_id: content.id,
          language: content.language,
          type: content.type,
          extension: content.extension,
          value: content.value.value,
        });
      }

      // check for provider in database
      const providers = await this._pg.select(
        { token: provider_token },
        "providers"
      );

      const {
        id: provider_id,
        name: provider_name,
        domain: provider_url,
      } = providers[0];

      let shortName: string;
      let typedName: string[];
      const disclaimer = DEFAULT_DISCLAIMER;

      if (license) {
        const regex = /\/licen[sc]es\/([\w\-]+)\//;
        const regexMatch = license.match(regex);
        if (regexMatch) {
          shortName = regexMatch[1];
          typedName = shortName.split("-");
        }
      } else {
        shortName = NO_LICENSE_DISCLAIMER;
      }

      const wikipedia = JSON.parse(JSON.stringify(features_public.value.value));
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
        material_id,
        title: title
          .replace(/\r*\n+/g, " ")
          .replace(/\t+/g, " ")
          .trim(),
        description: description
          ? description
              .replace(/\r*\n+/g, " ")
              .replace(/\t+/g, " ")
              .trim()
          : null,
        creation_date,
        retrieved_date,
        extension: type,
        type: materialType(mimetype),
        mimetype,
        material_url,
        website_url,
        provider_id,
        provider_name,
        provider_url,
        language,
        license: {
          short_name: shortName,
          typed_name: typedName,
          disclaimer,
          license,
        },
        contents,
        wikipedia,
      };

      // get the record and push it to the elasticsearch index
      await this._es.pushRecord("oer_materials", record, record.material_id);
      // refresh the index after pushing the new record
      await this._es.refreshIndex("oer_materials");

      // continue with the last patching
      return this._finalBolt ? null : await this._onEmit(message, stream_id);
    } catch (error) {
      // TODO: handle the error
      return this._finalBolt ? null : await this._onEmit(message, stream_id);
    }
  }
}

const create = () => new ESCreateBolt();

export { create };

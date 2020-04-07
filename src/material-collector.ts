/**
 * Material Collector component
 * This component listens to the incoming user activity data
 * and then crawls pages that were previously not seen.
 *
 */

// interfaces
import * as Interfaces from "./Interfaces";

// configurations
import config from "./config/config";
import * as mimetypes from "./config/mimetypes.json";

// modules
import KafkaConsumer from "./library/kafka-consumer";
import KafkaProducer from "./library/kafka-producer";
import PostgreSQL from "./library/postgresQL";

import Logger from "./library/logger";

// create a logger for platform requests
const logger = Logger.createGroupInstance("material-collector", "preproc", config.isProduction);


class MaterialCollector {

    public _consumer: KafkaConsumer;
    public _producer: KafkaProducer;

    private _pg: PostgreSQL;
    private _textTopic: string;
    private _videoTopic: string;
    private _apis: any[];

    private _productionModeFlag: boolean;

    constructor(params: Interfaces.IConfiguration) {
        // set postgresQL connection
        this._pg = new PostgreSQL(params.pg);

        // set kafka consumer & producers
        this._consumer = new KafkaConsumer({
            host: params.kafka.host,
            topic: "STORE_USERACTIVITY_VISIT",
            groupId: `${params.kafka.groupId}.MATERIAL.COLLECTOR`,
            high_water: 10,
            low_water: 1
        });
        this._producer = new KafkaProducer(params.kafka.host);
        // define kafka topic names
        this._textTopic = "PREPROC_MATERIAL_TEXT";
        this._videoTopic = "PREPROC_MATERIAL_VIDEO";

        // initialize retriever list
        this._apis = [];
        // go through retriever configurations and add them to the list
        for (const retriever of params.retrievers) {
            retriever.config.callback = this._sendMaterials.bind(this);
            retriever.config.token = retriever.token;
            retriever.config.pg = this._pg;
            this.addRetriever(retriever);
        }
        // set the production mode flag
        this._productionModeFlag = params.isProduction;
        // got initialization process
        logger.info("[MaterialCollector] collector initialized");
    }


    // adds an API retriever to the list
    addRetriever(settings: Interfaces.IConfigRetriever) {
        // if retriever is already set skip its addition
        for (const api of this._apis) {
            // check if retriever is already in added
            if (settings.token === api.token) { return false; }
        }

        // initialize the retriever given by the config file
        const retriever = new (require(`./retrievers/${settings.script}`))(settings.config);
        // add retriever to the list
        this._apis.push({
            name: settings.name,
            domain: settings.domain,
            token: settings.token,
            retriever
        });
        logger.info("[Retriever] Adding new retriever", {
            name: settings.name,
            domain: settings.domain
        });
        return true;
    }


    // removes an API retriever from the list
    removeRetriever(token: string) {
        let removed = false;
        // go through all of the apis and remove the appropriate retriever
        for (let i = 0; i < this._apis.length; i++) {
            if (token === this._apis[i].token) {
                logger.info("[Retriever] removing retriever", {
                    name: this._apis[i].name,
                    domain: this._apis[i].domain
                });
                // first stop the retriever
                this._apis[i].retriever.stop();
                // remove the retriever from the list
                this._apis.splice(i, 1);
                removed = true;
                break;
            }
        }
        return removed;
    }


    // start retriever crawling
    startRetriever(token: string) {
        let started = false;
        // go through all of the apis and start the appropriate retriever
        for (const api of this._apis) {
            if (token === api.token) {
                logger.info("[Retriever] start retriever", {
                    name: api.name,
                    domain: api.domain
                });
                api.retriever.start();
                started = true;
                break;
            }
        }
        return started;
    }

    // stop retriever from crawling
    stopRetriever(token: string, allFlag=false) {
        if (allFlag) {
            // stop all retrievers
            for (const api of this._apis) {
                logger.info("[Retriever] stop all retrievers");
                api.retriever.stop();
            }
            return true;
        } else {
            let stopped = false;
            // go through all of the apis and stop the appropriate retriever
            for (const api of this._apis) {
                if (token === api.token) {
                    logger.info("[Retriever] stop retriever", {
                        name: api.name,
                        domain: api.domain
                    });
                    api.retriever.stop();
                    stopped = true;
                    break;
                }
            }
            return stopped;
        }
    }

    // process the next message in the retrieval topic
    async processNext() {
        // get message sent to retrieval.topics
        const log = this._consumer.next();
        if (!log) { return null; }

        if (log.material) {
            // check if there is a material url
            const url = log.material.materialurl;
            // check if the material is already in the database
            // (should have an URL in the urls table)
            try {
                const results = await this._pg.select({ url }, "material_process_queue");
                if (!results.length) {
                    logger.info("[Retriever] process next material from log", {
                        materialurl: url,
                        timestamp: log.visitedOn
                    });
                    // send the material directly to the pipeline
                    return await this._sendMaterials(null, [log.material]);
                }
                logger.info("[Retriever] material already in processing pipeline", {
                    materialurl: url,
                    timestamp: log.visitedOn
                });
            } catch (error) {
                // log postgres error
                logger.error("error [postgres.select]: unable to select a material", { error: error.message });
                return null;
            }

        } else if (log.provider) {
            // find the appropriate retriever for retrieving the materials
            for (const api of this._apis) {
                // find the retriver based on the provider token
                if (log.provider === api.token) {
                    logger.info("[Retriever] process next log with retriever", {
                        retrieverName: api.name,
                        retrieverDomain: api.domain,
                        materialUrl: log.url
                    });
                    // if retriever is present get the material
                    const materials = await api.retriever.getMaterial(log.url);
                    // send the material directly to the pipeline
                    return await this._sendMaterials(null, materials);
                }
            }
            logger.warn("[Retriever] no retrievers to process log", {
                provider: log.provider,
                url: log.url
            });
        }
    }

    // redirect the material in the coresponding preprocessing pipeline
    async _sendMaterials(error: Error, materials: any) {
        if (error) {
            logger.error("[Retriever] error when processing materials", {
                error: {
                    message: error.message,
                    stack: error.stack
                }
            });
            return;
        }
        for (const material of materials) {
            // get material mimetype and decide where to send the material metadata
            const mimetype = material.type.mime;
            if (mimetype && mimetypes.video.includes(mimetype)) {
                await this._sendToKafka(material, this._videoTopic, "video");
            } else if (mimetype && mimetypes.audio.includes(mimetype)) {
                await this._sendToKafka(material, this._videoTopic, "audio");
            } else if (mimetype && mimetypes.text.includes(mimetype)) {
                await this._sendToKafka(material, this._textTopic, "text");
            } else {
                logger.warn("[Retriever] material mimetype not recognized", {
                    mimetype
                });
            }
        }
    }

    // sends the material to the appropriate kafka topic.
    async _sendToKafka(material: any, topic: string, type: string) {
        if (this._productionModeFlag) {
            try {
               // insert to postgres process pipeline
                await this._pg.upsert({ url: material.material_url }, { url: null }, "material_process_queue");
            } catch (error) {
                logger.error("[error] postgresql", {
                    error: {
                        message: error.message,
                        stack: error.stack
                    }
                });
                return;
            }
        }
        logger.info(`[upload] ${type} material = ${material.material_url}`);
        // send material to kafka
        return this._producer.send(topic, material);
    }
}

// /////////////////////////////////////////////////////
// Start Collector Processes
// /////////////////////////////////////////////////////


// initialize a material collector
const collector = new MaterialCollector(config);

// set interval to check for new log after every second
const interval = setInterval(() => {
    collector.processNext().catch((error) => { console.log(error); });
}, 1000);


// gracefully shuts down the collector object
function shutdown(error: any) {
    if (error) { console.log(error); }
    clearInterval(interval);
    // first stop all retrievers
    collector.stopRetriever(null, true);
    // stop the Kafka consumer before
    // shutting down the process
    collector._consumer.stop(() => {
        console.log("Stopped retrieving requests");
        return process.exit(0);
    });
}

// catches ctrl+c event
process.on("SIGINT", shutdown);
// catches uncaught exceptions
process.on("uncaughtException", shutdown);

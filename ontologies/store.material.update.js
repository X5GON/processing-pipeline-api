// configurations
const { default: config } = require("../dist/config/config");

const productionMode = config.isProduction;

module.exports = {
    general: {
        heartbeat: 2000,
        pass_binary_messages: true
    },
    spouts: [
        {
            name: "kafka.material.update",
            type: "inproc",
            working_dir: "./pipelines/spouts",
            cmd: "kafka-spout.js",
            init: {
                kafka: {
                    host: config.kafka.host,
                    topic: "UPDATE_MATERIAL_CONTENT",
                    groupId: config.kafka.groupId,
                    high_water: 10,
                    low_water: 2
                }
            }
        }
    ],
    bolts: [
    /** **************************************
     * Storing OER materials into database
     */

        {
            name: "store.pg.material.update",
            type: "inproc",
            working_dir: "./pipelines/bolts",
            cmd: "store-pg-material-update.js",
            inputs: [
                {
                    source: "kafka.material.update"
                }
            ],
            init: {
                pg: config.pg,
            }
        },

        // LOGGING STATE OF MATERIAL PROCESS
        ...(productionMode
            ? [
                {
                    name: "log.material.process.update.stored",
                    type: "inproc",
                    working_dir: "./pipelines/bolts",
                    cmd: "message-postgresql.js",
                    inputs: [
                        {
                            source: "store.pg.material.update"
                        }
                    ],
                    init: {
                        pg: config.pg,
                        postgres_table: "material_process_queue",
                        postgres_primary_id: "material_url",
                        message_primary_id: "material_url",
                        postgres_method: "update",
                        postgres_literal_attrs: {
                            status:
                  "[STORE] material stored inside the database. Updating the search index"
                        },
                        document_error_path: "message"
                    }
                }
            ]
            : []),

        // update elasticsearch index
        {
            name: "store.pg.material.elasticsearch",
            type: "inproc",
            working_dir: "./pipelines/bolts",
            cmd: "es-material-update.js",
            inputs: [
                {
                    source: productionMode
                        ? "log.material.process.update.stored"
                        : "store.pg.material.update"
                }
            ],
            init: {
                elasticsearch: config.elasticsearch,
                final_bolt: !productionMode
            }
        },

        // LOGGING STATE OF MATERIAL PROCESS
        ...(productionMode
            ? [
                {
                    name: "log.material.process.update.finished",
                    type: "inproc",
                    working_dir: "./pipelines/bolts",
                    cmd: "message-postgresql.js",
                    inputs: [
                        {
                            source: "store.pg.material.elasticsearch"
                        }
                    ],
                    init: {
                        pg: config.pg,
                        postgres_table: "material_update_queue",
                        postgres_primary_id: "material_id",
                        message_primary_id: "material_id",
                        postgres_method: "update",
                        postgres_time_attrs: {
                            end_process_time: true
                        },
                        postgres_literal_attrs: {
                            status: "material updated"
                        },
                        document_error_path: "message",
                        final_bolt: true
                    }
                }
            ]
            : [])
    ],
    variables: {}
};

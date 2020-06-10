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
            name: "kafka.material.complete",
            type: "inproc",
            working_dir: "./pipelines/spouts",
            cmd: "kafka-spout.js",
            init: {
                kafka: {
                    host: config.kafka.host,
                    topic: "STORE_MATERIAL_COMPLETE",
                    groupId: config.kafka.groupId,
                    high_water: 10,
                    low_water: 1
                }
            }
        }
    ],
    bolts: [
        {
            name: "store.pg.material.complete",
            type: "inproc",
            working_dir: "./pipelines/bolts",
            cmd: "store-pg-material-complete.js",
            inputs: [
                {
                    source: "kafka.material.complete"
                }
            ],
            init: {
                pg: config.pg,
                final_bolt: !productionMode
            }
        },

        // LOGGING STATE OF MATERIAL PROCESS
        ...(productionMode
            ? [
                {
                    name: "log.material.process.stored",
                    type: "inproc",
                    working_dir: "./pipelines/bolts",
                    cmd: "message-postgresql.js",
                    inputs: [
                        {
                            source: "store.pg.material.complete"
                        }
                    ],
                    init: {
                        pg: config.pg,
                        postgres_table: "material_process_queue",
                        postgres_primary_id: "material_url",
                        message_primary_id: "urls.material_url",
                        postgres_method: "update",
                        postgres_literal_attrs: {
                            status: "[STORE] material stored inside the database. Updating the search index"
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
            cmd: "es-material-new.js",
            inputs: [
                {
                    source: productionMode
                        ? "log.material.process.stored"
                        : "store.pg.material.complete"
                }
            ],
            init: {
                elasticsearch: config.elasticsearch,
                pg: config.pg,
                final_bolt: !productionMode
            }
        },

        // LOGGING STATE OF MATERIAL PROCESS
        ...(productionMode
            ? [
                {
                    name: "log.material.process.complete.finished",
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
                        postgres_table: "material_process_queue",
                        postgres_primary_id: "material_url",
                        message_primary_id: "urls.material_url",
                        postgres_method: "update",
                        postgres_message_attrs: {
                            material_id: "oer_materials.material_id"
                        },
                        postgres_time_attrs: {
                            end_process_time: true
                        },
                        postgres_literal_attrs: {
                            status: "material stored"
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

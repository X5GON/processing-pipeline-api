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
            name: "kafka.material.partial",
            type: "inproc",
            working_dir: "./pipelines/spouts",
            cmd: "kafka-spout.js",
            init: {
                kafka: {
                    host: config.kafka.host,
                    topic: "STORE_MATERIAL_INCOMPLETE",
                    groupId: config.kafka.groupId,
                    high_water: 10,
                    low_water: 1
                }
            }
        }
    ],
    bolts: [
        {
            name: "store.pg.material.partial",
            type: "inproc",
            working_dir: "./pipelines/bolts",
            cmd: "store-pg-material-partial.js",
            inputs: [
                {
                    source: "kafka.material.partial"
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
                    name: "log.material.process.finished",
                    type: "inproc",
                    working_dir: "./pipelines/bolts",
                    cmd: "message-postgresql.js",
                    inputs: [
                        {
                            source: "store.pg.material.partial"
                        }
                    ],
                    init: {
                        pg: config.pg,
                        postgres_table: "material_process_queue",
                        postgres_primary_id: "material_url",
                        message_primary_id: "oer_materials_partial.materialurl",
                        postgres_method: "update",
                        postgres_time_attrs: {
                            end_process_time: true
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

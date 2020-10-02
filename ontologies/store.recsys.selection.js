// configurations
const { default: config } = require("../dist/config/config");

module.exports = {
    general: {
        heartbeat: 2000,
        pass_binary_messages: true
    },
    spouts: [
        {
            name: "kafka.recsys.selection",
            type: "inproc",
            working_dir: "./components/spouts",
            cmd: "kafka-spout.js",
            init: {
                kafka: {
                    host: config.kafka.host,
                    topic: "STORE_RECSYS_SELECTION",
                    clientId: "STORE_RECSYS_SELECTION",
                    groupId: `${config.kafka.groupId}_STORE_RECSYS_SELECTION`,
                    high_water: 100,
                    low_water: 10
                }
            }
        }
    ],
    bolts: [
        {
            name: "store.pg.recsys.selection",
            type: "inproc",
            working_dir: "./components/bolts",
            cmd: "store-pg-recsys-selections.js",
            inputs: [
                {
                    source: "kafka.recsys.selection"
                }
            ],
            init: {
                pg: config.pg
            }
        }
    ],
    variables: {}
};

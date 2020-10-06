// configurations
const { default: config } = require("../dist/config/config");

module.exports = {
    general: {
        heartbeat: 2000,
        pass_binary_messages: true
    },
    spouts: [
        {
            name: "kafka.providers",
            type: "inproc",
            working_dir: "./components/spouts",
            cmd: "kafka-spout.js",
            init: {
                kafka: {
                    host: config.kafka.host,
                    topic: "STORE_PROVIDER",
                    clientId: "STORE_PROVIDER",
                    groupId: `${config.kafka.groupId}_STORE_PROVIDER`,
                    high_water: 100,
                    low_water: 10
                }
            }
        }
    ],
    bolts: [
        {
            name: "store.pg.providers",
            type: "inproc",
            working_dir: "./components/bolts",
            cmd: "store-pg-providers.js",
            inputs: [
                {
                    source: "kafka.providers"
                }
            ],
            init: {
                pg: config.pg
            }
        }
    ],
    variables: {}
};

// configurations
const { default: config } = require("../dist/config/config");

module.exports = {
    general: {
        heartbeat: 2000,
        pass_binary_messages: true
    },
    spouts: [
        {
            name: "kafka.user-activities.visits",
            type: "inproc",
            working_dir: "./components/spouts",
            cmd: "kafka_spout.js",
            init: {
                kafka: {
                    host: config.kafka.host,
                    topic: "STORE_USERACTIVITY_VISIT",
                    clientId: "STORE_USERACTIVITY_VISIT",
                    groupId: `${config.kafka.groupId}_STORE_USERACTIVITY_VISIT`,
                    high_water: 100,
                    low_water: 10
                }
            }
        },
        {
            name: "kafka.user-activities.video",
            type: "inproc",
            working_dir: "./components/spouts",
            cmd: "kafka_spout.js",
            init: {
                kafka: {
                    host: config.kafka.host,
                    topic: "STORE_USERACTIVITY_VIDEO",
                    clientId: "STORE_USERACTIVITY_VIDEO",
                    groupId: `${config.kafka.groupId}_STORE_USERACTIVITY_VIDEO`,
                    high_water: 100,
                    low_water: 10
                }
            }
        }
    ],
    bolts: [
    /** **************************************
     * Storing user activity into database
     */
        {
            name: "store.pg.user-activity.visits",
            type: "inproc",
            working_dir: "./components/bolts",
            cmd: "pg_store_ua_visits_bolt.js",
            inputs: [
                {
                    source: "kafka.user-activities.visits"
                }
            ],
            init: {
                pg: config.pg
            }
        },

        /** **************************************
     * Logging user activity
     */
        {
            name: "log.user-activity.connect",
            type: "inproc",
            working_dir: "./components/bolts",
            cmd: "msg_logging_bolt.js",
            inputs: [
                {
                    source: "kafka.user-activities.visits"
                },
                {
                    source: "kafka.user-activities.video"
                }
            ],
            init: {
                logging: {
                    file_name: "user-activities",
                    level: "info",
                    sub_folder: "user-activities",
                    archive: true,
                    message_type: "user_activity"
                },
                final_bolt: true
            }
        }
    ],
    variables: {}
};

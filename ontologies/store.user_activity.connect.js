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
            working_dir: "./pipelines/spouts",
            cmd: "kafka-spout.js",
            init: {
                kafka: {
                    host: config.kafka.host,
                    topic: "STORE_USERACTIVITY_VISIT",
                    groupId: config.kafka.groupId,
                    high_water: 10,
                    low_water: 1
                }
            }
        },
        {
            name: "kafka.user-activities.video",
            type: "inproc",
            working_dir: "./pipelines/spouts",
            cmd: "kafka-spout.js",
            init: {
                kafka: {
                    host: config.kafka.host,
                    topic: "STORE_USERACTIVITY_VIDEO",
                    groupId: config.kafka.groupId,
                    high_water: 10,
                    low_water: 1
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
            working_dir: "./pipelines/bolts",
            cmd: "store-pg-user-activity-visits.js",
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
            working_dir: "./pipelines/bolts",
            cmd: "message-logging.js",
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

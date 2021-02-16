// configurations
const { default: config } = require("../dist/config/config");

const productionMode = config.isProduction;

module.exports = {
  general: {
    heartbeat: 2000,
    pass_binary_messages: true,
  },
  spouts: [
    {
      name: "kafka.material.partial",
      type: "inproc",
      working_dir: "./components/spouts",
      cmd: "kafka_spout.js",
      init: {
        kafka: {
          host: config.kafka.host,
          topic: "STORE_MATERIAL_INCOMPLETE",
          clientId: "STORE_MATERIAL_INCOMPLETE",
          groupId: `${config.kafka.groupId}_STORE_MATERIAL_INCOMPLETE`,
          high_water: 100,
          low_water: 10,
        },
      },
    },
  ],
  bolts: [
    {
      name: "store.pg.material.partial",
      type: "inproc",
      working_dir: "./components/bolts",
      cmd: "pg_store_new_incomplete_bolt.js",
      inputs: [
        {
          source: "kafka.material.partial",
        },
      ],
      init: {
        pg: config.pg,
        final_bolt: !productionMode,
      },
    },
    // LOGGING STATE OF MATERIAL PROCESS
    ...(productionMode
      ? [
          {
            name: "log.material.process.finished",
            type: "inproc",
            working_dir: "./components/bolts",
            cmd: "pg_logging_bolt.js",
            inputs: [
              {
                source: "store.pg.material.partial",
              },
            ],
            init: {
              pg: config.pg,
              postgres_table: "material_process_queue",
              postgres_primary_id: "material_url",
              message_primary_id: "oer_materials_partial.materialurl",
              postgres_method: "update",
              postgres_message_attrs: {
                status: "oer_materials_partial.message",
              },
              postgres_time_attrs: {
                end_process_time: true,
              },
              document_error_path: "message",
              final_bolt: true,
            },
          },
        ]
      : []),
  ],
  variables: {},
};

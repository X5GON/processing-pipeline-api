// global configuration
const { default: config } = require("../dist/config/config");

const productionMode = config.isProduction;

// topology definition
module.exports = {
  general: {
    heartbeat: 2000,
    pass_binary_messages: true,
  },
  spouts: [
    {
      name: "input.kafka.video",
      type: "inproc",
      working_dir: "./components/spouts",
      cmd: "kafka_spout.js",
      init: {
        kafka: {
          host: config.kafka.host,
          topic: "UPDATE_MATERIAL_VIDEO",
          clientId: "UPDATE_MATERIAL_VIDEO",
          groupId: `${config.kafka.groupId}_UPDATE_MATERIAL_VIDEO`,
          high_water: 5,
          low_water: 0,
        },
      },
    },
  ],
  bolts: [
    // LOGGING STATE OF MATERIAL PROCESS
    ...(productionMode
      ? [
          {
            name: "log.material.update.started",
            type: "inproc",
            working_dir: "./components/bolts",
            cmd: "pg_logging_bolt.js",
            inputs: [
              {
                source: "input.kafka.video",
              },
            ],
            init: {
              pg: config.pg,
              postgres_table: "material_update_queue",
              postgres_primary_id: "material_id",
              message_primary_id: "material_id",
              postgres_method: "update",
              postgres_time_attrs: {
                start_process_time: true,
              },
              postgres_literal_attrs: {
                status:
                  "[VIDEO][0/2] material update started -> retrieving transcriptions and translations",
              },
              document_error_path: "message",
            },
          },
        ]
      : []),
    {
      name: "extract.video.ttp",
      type: "inproc",
      working_dir: "./components/bolts",
      cmd: "video_ttp_bolt.js",
      inputs: [
        {
          source: productionMode
            ? "log.material.update.started"
            : "input.kafka.video",
        },
      ],
      init: {
        ttp: {
          user: config.ttp.user,
          token: config.ttp.token,
        },
        document_language_path: "language",
        document_location_path: "material_url",
        document_authors_path: "authors",
        document_title_path: "title",
        document_text_path: "material_metadata.raw_text",
        document_transcriptions_path: "material_metadata.transcriptions",
        ttp_id_path: "material_metadata.ttp_id",
        document_error_path: "message",
      },
    },

    // LOGGING STATE OF MATERIAL PROCESS
    ...(productionMode
      ? [
          {
            name: "log.material.update.extract.video.ttp",
            type: "inproc",
            working_dir: "./components/bolts",
            cmd: "pg_logging_bolt.js",
            inputs: [
              {
                source: "extract.video.ttp",
              },
            ],
            init: {
              pg: config.pg,
              postgres_table: "material_update_queue",
              postgres_primary_id: "material_id",
              message_primary_id: "material_id",
              postgres_method: "update",
              postgres_literal_attrs: {
                status:
                  "[VIDEO][1/2] material transcriptions and translations retrieved -> retrieving wikipedia concepts",
              },
              document_error_path: "message",
            },
          },
        ]
      : []),

    {
      name: "extract.wikipedia",
      type: "inproc",
      working_dir: "./components/bolts",
      cmd: "wikipedia_bolt.js",
      inputs: [
        {
          source: productionMode
            ? "log.material.update.extract.video.ttp"
            : "extract.video.ttp",
        },
      ],
      init: {
        wikifier: {
          user_key: config.wikifier.userKey,
          wikifier_url: config.wikifier.wikifierURL,
          max_length: 20000,
        },
        document_text_path: "material_metadata.raw_text",
        wikipedia_concept_path: "material_metadata.wikipedia_concepts",
        document_error_path: "message",
      },
    },

    // LOGGING STATE OF MATERIAL PROCESS
    ...(productionMode
      ? [
          {
            name: "log.material.update.extract.wikipedia",
            type: "inproc",
            working_dir: "./components/bolts",
            cmd: "pg_logging_bolt.js",
            inputs: [
              {
                source: "extract.wikipedia",
              },
            ],
            init: {
              pg: config.pg,
              postgres_table: "material_update_queue",
              postgres_primary_id: "material_id",
              message_primary_id: "material_id",
              postgres_method: "update",
              postgres_literal_attrs: {
                status:
                  "[VIDEO][2/2] material wikified -> updating the material",
              },
              document_error_path: "message",
            },
          },
        ]
      : []),

    /** **************************************
     * Send the completely processed materials
     * to kafka distribution
     */

    {
      name: "kafka.material.content",
      type: "inproc",
      working_dir: "./components/bolts",
      cmd: "kafka_bolt.js",
      inputs: [
        {
          source: productionMode
            ? "log.material.update.extract.wikipedia"
            : "extract.wikipedia",
        },
      ],
      init: {
        kafka: {
          host: config.kafka.host,
          topic: "UPDATE_MATERIAL_CONTENT",
          clientId: "UPDATE_MATERIAL_CONTENT",
        },
      },
    },

    // LOGGING STATE OF MATERIAL PROCESS
    ...(productionMode
      ? [
          {
            name: "log.material.update.error",
            type: "inproc",
            working_dir: "./components/bolts",
            cmd: "pg_logging_bolt.js",
            inputs: [
              ...(productionMode
                ? [
                    {
                      source: "log.material.update.started",
                      stream_id: "stream_error",
                    },
                  ]
                : []),
              {
                source: "extract.video.ttp",
                stream_id: "stream_error",
              },
              ...(productionMode
                ? [
                    {
                      source: "log.material.update.extract.video.ttp",
                      stream_id: "stream_error",
                    },
                  ]
                : []),
              {
                source: "extract.wikipedia",
                stream_id: "stream_error",
              },
              ...(productionMode
                ? [
                    {
                      source: "log.material.update.extract.wikipedia",
                      stream_id: "stream_error",
                    },
                  ]
                : []),
            ],
            init: {
              pg: config.pg,
              postgres_table: "material_update_queue",
              postgres_primary_id: "material_id",
              message_primary_id: "material_id",
              postgres_method: "update",
              postgres_message_attrs: {
                status: "message",
              },
              postgres_time_attrs: {
                end_process_time: true,
              },
            },
          },
        ]
      : []),
  ],
  variables: {},
};

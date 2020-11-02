// global configuration
const { default: config } = require("../dist/config/config");

const formatMessages = require("../dist/components/utils/format-materials");

const productionMode = config.isProduction;

// topology definition
module.exports = {
  general: {
    heartbeat: 2000,
    pass_binary_messages: true,
  },
  spouts: [
    {
      name: "input.kafka.text",
      type: "inproc",
      working_dir: "./components/spouts",
      cmd: "kafka_spout.js",
      init: {
        kafka: {
          host: config.kafka.host,
          topic: "PREPROC_MATERIAL_TEXT_INDEXING",
          clientId: "PREPROC_MATERIAL_TEXT_INDEXING",
          groupId: `${config.kafka.groupId}_PREPROC_MATERIAL_TEXT_INDEXING`,
          high_water: 10,
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
            name: "log.material.process.started",
            type: "inproc",
            working_dir: "./components/bolts",
            cmd: "pg_logging_bolt.js",
            inputs: [
              {
                source: "input.kafka.text",
              },
            ],
            init: {
              pg: config.pg,
              postgres_table: "material_process_queue",
              postgres_primary_id: "material_url",
              message_primary_id: "material_url",
              postgres_method: "update",
              postgres_time_attrs: {
                start_process_time: true,
              },
              postgres_literal_attrs: {
                status:
                  "[TEXT][0/5] material processing started -> transforming format",
              },
              document_error_path: "message",
            },
          },
        ]
      : []),

    {
      name: "transform.material",
      working_dir: ".",
      type: "sys",
      cmd: "transform",
      inputs: [
        {
          source: productionMode
            ? "log.material.process.started"
            : "input.kafka.text",
        },
      ],
      init: {
        output_template: {
          title: "title",
          description: "description",
          provider_uri: "provider_uri",
          material_url: "material_url",
          authors: "author",
          language: "language",
          creation_date: "date_created",
          retrieved_date: "retrieved_date",
          type: "type.ext",
          mimetype: "type.mime",
          provider: { token: "provider_token" },
          license: "license",
          material_metadata: {
            metadata: "material_metadata.metadata",
            raw_text: "material_metadata.raw_text",
            wikipedia_concepts: {},
          },
        },
      },
    },
    // LOGGING STATE OF MATERIAL PROCESS
    ...(productionMode
      ? [
          {
            name: "log.material.process.formatting",
            type: "inproc",
            working_dir: "./components/bolts",
            cmd: "pg_logging_bolt.js",
            inputs: [
              {
                source: "transform.material",
              },
            ],
            init: {
              pg: config.pg,
              postgres_table: "material_process_queue",
              postgres_primary_id: "material_url",
              message_primary_id: "material_url",
              postgres_method: "update",
              postgres_literal_attrs: {
                status:
                  "[TEXT][1/5] material object schema transformed -> extracting raw material content",
              },
              document_error_path: "message",
            },
          },
        ]
      : []),

    {
      name: "extract.text.raw",
      type: "inproc",
      working_dir: "./components/bolts",
      cmd: "text_bolt.js",
      inputs: [
        {
          source: productionMode
            ? "log.material.process.formatting"
            : "transform.material",
        },
      ],
      init: {
        textract_config: {
          preserve_line_breaks: true,
          preserve_only_multiple_line_breaks: false,
          include_alt_text: true,
        },
        document_location_path: "material_url",
        document_location_type: "remote",
        document_text_path: "material_metadata.raw_text",
        document_error_path: "message",
      },
    },

    // LOGGING STATE OF MATERIAL PROCESS
    ...(productionMode
      ? [
          {
            name: "log.material.process.extract.text.raw",
            type: "inproc",
            working_dir: "./components/bolts",
            cmd: "pg_logging_bolt.js",
            inputs: [
              {
                source: "extract.text.raw",
              },
            ],
            init: {
              pg: config.pg,
              postgres_table: "material_process_queue",
              postgres_primary_id: "material_url",
              message_primary_id: "material_url",
              postgres_method: "update",
              postgres_literal_attrs: {
                status:
                  "[TEXT][2/5] material content extracted -> retrieving wikipedia concepts",
              },
              document_error_path: "message",
            },
          },
        ]
      : []),

    {
      name: "language.detection",
      type: "inproc",
      working_dir: "./components/bolts",
      cmd: "lang_detect_bolt.js",
      inputs: [
        {
          source: productionMode
            ? "log.material.process.extract.text.raw"
            : "extract.text.raw",
        },
      ],
      init: {
        document_text_path: "material_metadata.raw_text",
        document_lang_detect_path: "language_detected",
        lang_detect_service_metadata: config.languageDetection,
        document_text_path: "material_metadata.raw_text",
        document_error_path: "message",
      },
    },

    // LOGGING STATE OF MATERIAL PROCESS
    ...(productionMode
      ? [
          {
            name: "log.material.process.language.detection",
            type: "inproc",
            working_dir: "./components/bolts",
            cmd: "pg_logging_bolt.js",
            inputs: [
              {
                source: "language.detection",
              },
            ],
            init: {
              pg: config.pg,
              postgres_table: "material_process_queue",
              postgres_primary_id: "material_url",
              message_primary_id: "material_url",
              postgres_method: "update",
              postgres_literal_attrs: {
                status:
                  "[TEXT][3/5] language detected -> retrieving translations",
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
            ? "log.material.process.language.detection"
            : "language.detection",
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
            name: "log.material.process.extract.wikipedia",
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
              postgres_table: "material_process_queue",
              postgres_primary_id: "material_url",
              message_primary_id: "material_url",
              postgres_method: "update",
              postgres_literal_attrs: {
                status: "[TEXT][4/5] material wikified -> validating material",
              },
              document_error_path: "message",
            },
          },
        ]
      : []),

    {
      name: "message.validate",
      type: "inproc",
      working_dir: "./components/bolts",
      cmd: "validate_bolt.js",
      inputs: [
        {
          source: productionMode
            ? "log.material.process.extract.wikipedia"
            : "extract.wikipedia",
        },
      ],
      init: {
        json_schema: require("../schemas/material"),
        document_error_path: "message",
      },
    },

    // LOGGING STATE OF MATERIAL PROCESS
    ...(productionMode
      ? [
          {
            name: "log.material.process.message.validate",
            type: "inproc",
            working_dir: "./components/bolts",
            cmd: "pg_logging_bolt.js",
            inputs: [
              {
                source: "message.validate",
              },
            ],
            init: {
              pg: config.pg,
              postgres_table: "material_process_queue",
              postgres_primary_id: "material_url",
              message_primary_id: "material_url",
              postgres_method: "update",
              postgres_literal_attrs: {
                status:
                  "[TEXT][5/5] material validated -> storing the material",
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
      name: "kafka.material.complete",
      type: "inproc",
      working_dir: "./components/bolts",
      cmd: "kafka_bolt.js",
      inputs: [
        {
          source: productionMode
            ? "log.material.process.message.validate"
            : "message.validate",
        },
      ],
      init: {
        kafka: {
          host: config.kafka.host,
          topic: "STORE_MATERIAL_COMPLETE",
          clientId: "STORE_MATERIAL_COMPLETE",
        },
        format_message: formatMessages.formatMaterialComplete,
      },
    },

    {
      name: "kafka.material.partial",
      type: "inproc",
      working_dir: "./components/bolts",
      cmd: "kafka_bolt.js",
      inputs: [
        ...(productionMode
          ? [
              {
                source: "log.material.process.started",
                stream_id: "stream_error",
              },
            ]
          : []),
        ...(productionMode
          ? [
              {
                source: "log.material.process.formatting",
                stream_id: "stream_error",
              },
            ]
          : []),
        {
          source: "extract.text.raw",
          stream_id: "stream_error",
        },
        ...(productionMode
          ? [
              {
                source: "log.material.process.extract.text.raw",
                stream_id: "stream_error",
              },
            ]
          : []),
        {
          source: "language.detection",
          stream_id: "stream_error",
        },
        ...(productionMode
          ? [
              {
                source: "log.material.process.language.detection",
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
                source: "log.material.process.extract.wikipedia",
                stream_id: "stream_error",
              },
            ]
          : []),
        {
          source: "message.validate",
          stream_id: "stream_error",
        },
      ],
      init: {
        kafka: {
          host: config.kafka.host,
          topic: "STORE_MATERIAL_INCOMPLETE",
          clientId: "STORE_MATERIAL_INCOMPLETE",
        },
        format_message: formatMessages.formatMaterialPartial,
      },
    },
  ],
  variables: {},
};

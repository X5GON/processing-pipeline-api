// global configuration
const { default: config } = require("../dist/config/config");

const productionMode = config.isProduction;

// supported types
typeRouterPDF = ["pdf", "docx", "doc", "pptx", "ppt"];

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
          topic: "UPDATE_MATERIAL_TEXT",
          clientId: "UPDATE_MATERIAL_TEXT",
          groupId: `${config.kafka.groupId}_UPDATE_MATERIAL_TEXT`,
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
                source: "input.kafka.text",
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
                  "[TEXT][0/5] material update started -> retrieving the stored material content",
              },
              document_error_path: "message",
            },
          },
        ]
      : []),

    {
      name: "get.material.content",
      type: "inproc",
      working_dir: "./components/bolts",
      cmd: "msg_content_bolt.js",
      inputs: [
        {
          source: productionMode
            ? "log.material.update.started"
            : "input.kafka.text",
        },
      ],
      init: {
        pg: config.pg,
      },
    },

    // LOGGING STATE OF MATERIAL PROCESS
    ...(productionMode
      ? [
          {
            name: "log.material.update.get.material.content",
            type: "inproc",
            working_dir: "./components/bolts",
            cmd: "pg_logging_bolt.js",
            inputs: [
              {
                source: "get.material.content",
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
                  "[TEXT][1/5] existing material content extracted -> extracting the raw material content",
              },
              document_error_path: "message",
            },
          },
        ]
      : []),

    {
      name: "type-router",
      type: "sys",
      working_dir: ".",
      cmd: "router",
      inputs: [
        {
          source: productionMode
            ? "log.material.update.get.material.content"
            : "get.material.content",
        },
      ],
      init: {
        routes: {
          pdf: {
            type: typeRouterPDF,
          },
          doc: {
            type: {
              $like: `^(?!${typeRouterPDF.join("|")}).*$`,
            },
          },
        },
      },
    },

    {
      name: "extract.text.raw",
      type: "inproc",
      working_dir: "./components/bolts",
      cmd: "text_bolt.js",
      inputs: [
        {
          source: "type-router",
          stream_id: "doc",
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

    {
      name: "doc-pdf",
      type: "inproc",
      working_dir: "./components/bolts",
      cmd: "pdf_bolt.js",
      inputs: [
        {
          source: "type-router",
          stream_id: "pdf",
        },
      ],
      init: {
        document_location_path: "material_url",
        document_location_type: "remote",
        document_pdf_path: "material_metadata",
        pdf_extract_metadata: [
          { attribute: "pages", location: "pages" },
          { attribute: "meta", location: "meta" },
          { attribute: "text", location: "raw_text" },
        ],
        pdf_trim_text: true,
        convert_to_pdf: true,
      },
    },
    {
      name: "pdf-router",
      type: "sys",
      working_dir: ".",
      cmd: "router",
      inputs: [
        {
          source: "doc-pdf",
          stream_id: "pdf",
        },
      ],
      init: {
        routes: {
          pdf: {
            "material_metadata.raw_text": {
              $like: "(?!^$)([^s])",
            },
          },
          ocr: {
            "material_metadata.raw_text": {
              $like: "^$|^s*$",
            },
          },
        },
      },
    },
    {
      name: "doc-ocr",
      type: "inproc",
      working_dir: "./components/bolts",
      cmd: "ocr_bolt.js",
      inputs: [
        {
          source: "pdf-router",
          stream_id: "ocr",
        },
      ],
      init: {
        document_location_path: "material_url",
        document_location_type: "remote",
        document_language_path: "language",
        document_ocr_path: "material_metadata.raw_text",
        temporary_folder: "../tmp",
      },
    },

    // LOGGING STATE OF MATERIAL PROCESS
    ...(productionMode
      ? [
          {
            name: "log.material.update.extract.text.raw",
            type: "inproc",
            working_dir: "./components/bolts",
            cmd: "pg_logging_bolt.js",
            inputs: [
              {
                source: "extract.text.raw",
                stream_id: "doc",
              },
              {
                source: "pdf-router",
                stream_id: "pdf",
              },
              {
                source: "doc-ocr",
                stream_id: "ocr",
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
                  "[TEXT][2/5] material content extracted -> retrieving translations",
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
          stream_id: "doc",
        },
        {
          source: productionMode
            ? "log.material.process.extract.text.raw"
            : "pdf-router",
          stream_id: "pdf",
        },
        {
          source: productionMode
            ? "log.material.process.extract.text.raw"
            : "doc-ocr",
          stream_id: "ocr",
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
            name: "log.material.update.language.detection",
            type: "inproc",
            working_dir: "./components/bolts",
            cmd: "pg_logging_bolt.js",
            inputs: [
              {
                source: "language.detection",
                stream_id: "doc",
              },
              {
                source: "language.detection",
                stream_id: "pdf",
              },
              {
                source: "language.detection",
                stream_id: "ocr",
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
      name: "extract.text.ttp",
      type: "inproc",
      working_dir: "./components/bolts",
      cmd: "text_ttp_bolt.js",
      inputs: [
        {
          source: productionMode
            ? "log.material.process.language.detection"
            : "language.detection",
          stream_id: "doc"
        },
        {
          source: productionMode
            ? "log.material.process.language.detection"
            : "language.detection",
          stream_id: "pdf"
        },
        {
          source: productionMode
            ? "log.material.process.language.detection"
            : "language.detection",
          stream_id: "ocr"
        },
      ],
      init: {
        ttp: {
          user: config.ttp.user,
          token: config.ttp.token,
        },
        temporary_folder: "../../tmp",
        document_title_path: "title",
        document_language_path: "language",
        document_text_path: "material_metadata.raw_text",
        document_transcriptions_path: "material_metadata.transcriptions",
        document_error_path: "message",
        ttp_id_path: "material_metadata.ttp_id",
      },
    },

    // LOGGING STATE OF MATERIAL PROCESS
    ...(productionMode
      ? [
          {
            name: "log.material.update.extract.text.ttp",
            type: "inproc",
            working_dir: "./components/bolts",
            cmd: "pg_logging_bolt.js",
            inputs: [
              {
                source: "extract.text.ttp",
                stream_id: "doc"
              },
              {
                source: "extract.text.ttp",
                stream_id: "pdf"
              },
              {
                source: "extract.text.ttp",
                stream_id: "ocr"
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
                  "[TEXT][4/5] material translations extracted -> retrieving wikipedia concepts",
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
            ? "log.material.process.extract.text.ttp"
            : "extract.text.ttp",
          stream_id: "doc"
        },
        {
          source: productionMode
            ? "log.material.process.extract.text.ttp"
            : "extract.text.ttp",
          stream_id: "pdf"
        },
        {
          source: productionMode
            ? "log.material.process.extract.text.ttp"
            : "extract.text.ttp",
          stream_id: "ocr"
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
                stream_id: "doc",
              },
              {
                source: "extract.wikipedia",
                stream_id: "pdf",
              },
              {
                source: "extract.wikipedia",
                stream_id: "ocr",
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
                  "[TEXT][5/5] material wikipedia extracted -> updating the material",
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
            ? "log.material.process.extract.wikipedia"
            : "extract.wikipedia",
          stream_id: "doc",
        },
        {
          source: productionMode
            ? "log.material.process.extract.wikipedia"
            : "extract.wikipedia",
          stream_id: "pdf",
        },
        {
          source: productionMode
            ? "log.material.process.extract.wikipedia"
            : "extract.wikipedia",
          stream_id: "ocr",
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
                source: "get.material.content",
                stream_id: "stream_error",
              },
              ...(productionMode
                ? [
                    {
                      source: "log.material.update.get.material.content",
                      stream_id: "stream_error",
                    },
                  ]
                : []),
              {
                source: "extract.text.raw",
                stream_id: "stream_error",
              },
              {
                source: "doc-pdf",
                stream_id: "stream_error",
              },
              {
                source: "doc-ocr",
                stream_id: "stream_error",
              },
              ...(productionMode
                ? [
                    {
                      source: "log.material.update.extract.text.raw",
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
                      source: "log.material.update.language.detection",
                      stream_id: "stream_error",
                    },
                  ]
                : []),
              {
                source: "extract.text.ttp",
                stream_id: "stream_error",
              },
              ...(productionMode
                ? [
                    {
                      source: "log.material.update.extract.text.ttp",
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
              final_bolt: true,
            },
          },
        ]
      : []),
  ],
  variables: {},
};

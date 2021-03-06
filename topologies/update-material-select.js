// global configuration
const { default: config } = require("../dist/config/config");

const productionMode = config.isProduction;

// topology definition
module.exports = {
    general: {
        heartbeat: 2000,
        pass_binary_messages: true
    },
    spouts: [
        {
            name: "input.postgres.materials",
            type: "inproc",
            working_dir: "./components/spouts",
            cmd: "postgres_spout.js",
            init: {
                pg: config.pg,
                sql_statement: `
                    WITH CURRENT_PROCESS AS (
                        SELECT
                        20 - (
                            SELECT COUNT(*)
                            FROM material_update_queue
                            WHERE end_process_time IS NULL
                        ) AS total
                    ),

                    CURRENT_PROCESS_QUOTA AS (
                        SELECT
                            CASE WHEN total < 0 THEN 0
                            ELSE total
                            END
                        FROM CURRENT_PROCESS
                    ),

                    URLS AS (
                        SELECT
                        COALESCE(m.material_id, c.material_id) AS material_id,
                        COALESCE(m.provider_id, c.provider_id) AS provider_id,
                        m.url AS material_url,
                        c.url AS container_url,
                        (SELECT COUNT(*) FROM user_activities AS ua WHERE ua.url_id = c.id) as u_count
                        FROM contains
                        LEFT JOIN urls m ON contains.contains_id = m.id
                        LEFT JOIN urls c ON contains.container_id = c.id
                        ORDER BY material_id
                    ),

                    OERS AS (
                        SELECT
                        URLS.material_id,
                        oer.title,
                        oer.description,
                        oer.creation_date,
                        oer.retrieved_date,
                        oer.type,
                        oer.mimetype,
                        URLS.material_url,
                        URLS.container_url AS provider_uri,
                        URLS.u_count,
                        oer.language,
                        oer.license

                        FROM URLS
                        LEFT JOIN oer_materials oer ON URLS.material_id = oer.id
                        LEFT JOIN providers     p   ON URLS.provider_id = p.id
                        WHERE oer.mimetype NOT LIKE '%video%' AND oer.mimetype NOT LIKE '%audio%' AND oer.mimetype NOT LIKE '%image%'
                    ),

                    CONTENT AS (
                        SELECT
                        material_id,
                        array_agg(last_updated) AS lu
                        FROM material_contents
                        GROUP BY material_id
                    )

                    SELECT *
                    FROM OERS
                    WHERE material_id IN (
                        SELECT
                        material_id
                        FROM CONTENT
                        WHERE array_position(lu, NULL) IS NOT NULL
                    )
                    AND material_id NOT IN (SELECT material_id FROM material_update_queue)
                    ORDER BY u_count DESC
                    LIMIT (SELECT total FROM CURRENT_PROCESS_QUOTA);
                `, // TODO: add the SQL statement for checking if the material is already in the queue
                // repeat every one day
                time_interval: 2 * 60 * 60 * 1000
            }
        }
    ],
    bolts: [
        {
            name: "update.material.transform",
            working_dir: ".",
            type: "sys",
            cmd: "transform",
            inputs: [
                {
                    source: "input.postgres.materials"
                }
            ],
            init: {
                output_template: {
                    material_id: "material_id",
                    title: "title",
                    description: "description",
                    provider_uri: "provider_uri",
                    material_url: "material_url",
                    language: "language",
                    creation_date: "creation_date",
                    retrieved_date: "retrieved_date",
                    type: "type",
                    mimetype: "mimetype",
                    license: "license",
                    material_metadata: {
                        metadata: "material_metadata.metadata",
                        raw_text: "material_metadata.raw_text",
                        wikipedia_concepts: {}
                    }
                }
            }
        },
        {
            name: "update.material.redirect",
            type: "inproc",
            working_dir: "./components/bolts",
            cmd: "msg_redirect_bolt.js",
            inputs: [{ source: "update.material.transform" }],
            init: {
                last_updated: "2019-08-01"
            }
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
                            source: "update.material.redirect",
                            stream_id: "updated"
                        }
                    ],
                    init: {
                        pg: config.pg,
                        postgres_table: "material_update_queue",
                        postgres_primary_id: "material_id",
                        message_primary_id: "material_id",
                        postgres_method: "upsert",
                        postgres_time_attrs: {
                            end_process_time: true
                        },
                        postgres_literal_attrs: {
                            status: "material updated"
                        },
                        document_error_path: "message",
                        final_bolt: true
                    }
                }
            ]
            : []),
        // LOGGING STATE OF MATERIAL PROCESS
        ...(productionMode
            ? [
                {
                    name: "log.material.process.unknown",
                    type: "inproc",
                    working_dir: "./components/bolts",
                    cmd: "pg_logging_bolt.js",
                    inputs: [
                        {
                            source: "update.material.redirect",
                            stream_id: "unknown"
                        }
                    ],
                    init: {
                        pg: config.pg,
                        postgres_table: "material_update_queue",
                        postgres_primary_id: "material_id",
                        message_primary_id: "material_id",
                        postgres_method: "upsert",
                        postgres_time_attrs: {
                            end_process_time: true
                        },
                        postgres_literal_attrs: {
                            status: "material unknown"
                        },
                        document_error_path: "message",
                        final_bolt: true
                    }
                }
            ]
            : []),
        // LOGGING STATE OF MATERIAL PROCESS
        ...(productionMode
            ? [
                {
                    name: "log.material.process.text",
                    type: "inproc",
                    working_dir: "./components/bolts",
                    cmd: "pg_logging_bolt.js",
                    inputs: [
                        {
                            source: "update.material.redirect",
                            stream_id: "text"
                        }
                    ],
                    init: {
                        pg: config.pg,
                        postgres_table: "material_update_queue",
                        postgres_primary_id: "material_id",
                        message_primary_id: "material_id",
                        postgres_method: "upsert",
                        postgres_time_attrs: {
                            start_process_time: true
                        },
                        postgres_literal_attrs: {
                            status: "[TEXT] in queue"
                        },
                        document_error_path: "message"
                    }
                }
            ]
            : []),
        // LOGGING STATE OF MATERIAL PROCESS
        ...(productionMode
            ? [
                {
                    name: "log.material.process.video",
                    type: "inproc",
                    working_dir: "./components/bolts",
                    cmd: "pg_logging_bolt.js",
                    inputs: [
                        {
                            source: "update.material.redirect",
                            stream_id: "video"
                        }
                    ],
                    init: {
                        pg: config.pg,
                        postgres_table: "material_update_queue",
                        postgres_primary_id: "material_id",
                        message_primary_id: "material_id",
                        postgres_method: "upsert",
                        postgres_time_attrs: {
                            start_process_time: true
                        },
                        postgres_literal_attrs: {
                            status: "[VIDEO] in queue"
                        },
                        document_error_path: "message"
                    }
                }
            ]
            : []),
        // LOGGING STATE OF MATERIAL PROCESS
        ...(productionMode
            ? [
                {
                    name: "log.material.process.audio",
                    type: "inproc",
                    working_dir: "./components/bolts",
                    cmd: "pg_logging_bolt.js",
                    inputs: [
                        {
                            source: "update.material.redirect",
                            stream_id: "audio"
                        }
                    ],
                    init: {
                        pg: config.pg,
                        postgres_table: "material_update_queue",
                        postgres_primary_id: "material_id",
                        message_primary_id: "material_id",
                        postgres_method: "upsert",
                        postgres_time_attrs: {
                            start_process_time: true
                        },
                        postgres_literal_attrs: {
                            status: "[AUDIO] in queue"
                        },
                        document_error_path: "message"
                    }
                }
            ]
            : []),

        {
            name: "kafka.material.update.text",
            type: "inproc",
            working_dir: "./components/bolts",
            cmd: "kafka_bolt.js",
            inputs: [
                {
                    source: productionMode
                        ? "log.material.process.text"
                        : "update.material.redirect",
                    stream_id: "text"
                }
            ],
            init: {
                kafka: {
                    host: config.kafka.host,
                    topic: "UPDATE_MATERIAL_TEXT",
                    clientId: "UPDATE_MATERIAL_TEXT"
                }
            }
        },
        {
            name: "kafka.material.update.video",
            type: "inproc",
            working_dir: "./components/bolts",
            cmd: "kafka_bolt.js",
            inputs: [
                {
                    source: productionMode
                        ? "log.material.process.video"
                        : "update.material.redirect",
                    stream_id: "video"
                },
                {
                    source: productionMode
                        ? "log.material.process.audio"
                        : "update.material.redirect",
                    stream_id: "audio"
                }
            ],
            init: {
                kafka: {
                    host: config.kafka.host,
                    topic: "UPDATE_MATERIAL_VIDEO",
                    clientId: "UPDATE_MATERIAL_VIDEO"
                }
            }
        }
    ],
    variables: {}
};

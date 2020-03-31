/** **********************************************
 * Project Configurations
 */

// interfaces
import * as Interfaces from "../Interfaces";

// modules
import * as path from "path";
import * as dotenv from "dotenv";

// import configured node variables
dotenv.config({ path: path.resolve(__dirname, "../../env/.env") });

// get process environment
const env = process.env.NODE_ENV || "development";

// the common configurations
const common = {
    environment: env,
    isProduction: env === "production",
    retrievers: [
        {
            name: "Videolectures.NET",
            domain: "http://videolectures.net/",
            script: "api-videolectures",
            token: process.env.TOKEN_VIDEOLECTURES,
            config: {
                apikey: process.env.RETRIEVERS_VL_APIKEY
            }
        }
    ],
    wikifier: {
        wikifierURL: process.env.PREPROC_WIKIFIER_URL,
        userKey: process.env.PREPROC_WIKIFIER_USERKEY
    },
    ttp: {
        user: process.env.PREPROC_TTP_USER,
        token: process.env.PREPROC_TTP_TOKEN
    }
};


// production environment configurations
const production = {
    elasticsearch: {
        node: process.env.PROD_ELASTICSEARCH_NODE
    },
    kafka: {
        host: process.env.PROD_KAFKA_HOST || "127.0.0.1:9092",
        groupId: process.env.PROD_KAFKA_GROUP || "productionGroup"
    },
    pg: {
        host: process.env.PROD_PG_HOST || "127.0.0.1",
        port: parseInt(process.env.PROD_PG_PORT, 10) || 5432,
        database: process.env.PROD_PG_DATABASE || "x5gon",
        max: parseInt(process.env.PROD_PG_MAX, 10) || 10,
        idleTimeoutMillis: parseInt(process.env.PROD_PG_IDLE_TIMEOUT_MILLIS, 10) || 30000,
        user: process.env.PROD_PG_USER || "postgres",
        password: process.env.PROD_PG_PASSWORD,
        schema: process.env.PROD_PG_SCHEMA || "public",
        version: process.env.PROD_PG_VERSION || "*"
    }
};

// development environment configurations
const development = {
    elasticsearch: {
        node: process.env.DEV_ELASTICSEARCH_NODE
    },
    kafka: {
        host: process.env.DEV_KAFKA_HOST || "127.0.0.1:9092",
        groupId: process.env.DEV_KAFKA_GROUP || "developmentGroup"
    },
    pg: {
        host: process.env.DEV_PG_HOST || "127.0.0.1",
        port: parseInt(process.env.DEV_PG_PORT, 10) || 5432,
        database: process.env.DEV_PG_DATABASE || "x5gon",
        max: parseInt(process.env.DEV_PG_MAX, 10) || 10,
        idleTimeoutMillis: parseInt(process.env.DEV_PG_IDLE_TIMEOUT_MILLIS, 10) || 30000,
        user: process.env.DEV_PG_USER || "postgres",
        password: process.env.DEV_PG_PASSWORD,
        schema: process.env.DEV_PG_SCHEMA || "public",
        version: process.env.DEV_PG_VERSION || "*"
    }
};

// test environment configurations
const test = {
    elasticsearch: {
        node: process.env.TEST_ELASTICSEARCH_NODE
    },
    kafka: {
        host: process.env.TEST_KAFKA_HOST || "127.0.0.1:9092",
        groupId: process.env.TEST_KAFKA_GROUP || "testGroup"
    },
    pg: {
        host: process.env.TEST_PG_HOST || "127.0.0.1",
        port: parseInt(process.env.TEST_PG_PORT, 10) || 5432,
        database: process.env.TEST_PG_DATABASE || "x5gon",
        max: parseInt(process.env.TEST_PG_MAX, 10) || 10,
        idleTimeoutMillis: parseInt(process.env.TEST_PG_IDLE_TIMEOUT_MILLIS, 10) || 30000,
        user: process.env.TEST_PG_USER || "postgres",
        password: process.env.TEST_PG_PASSWORD,
        schema: process.env.TEST_PG_SCHEMA || "public",
        version: process.env.TEST_PG_VERSION || "*"
    }
};

// store the configuration in a single json
const envGroups = {
    production,
    development,
    test
};

// creates a deep merge between two JSON objects
function merge(target: Interfaces.IConfigCommon, source: Interfaces.IConfigEnvironment): Interfaces.IConfiguration {
    // Iterate through `source` properties
    // If an `Object` set property to merge of `target` and `source` properties
    for (const key of Object.keys(source)) {
        if (source[key] instanceof Object) {
            Object.assign(source[key], merge(target[key], source[key]));
        }
    }
    // Join `target` and modified `source`
    return Object.assign(target || {}, source);
}

// export the environment variables
const config = merge(common, envGroups[env]);
export default config;

# Configuration

This folder contains the configuration files.

## Environment Variables

To avoid storing vulnerable data in the repository (such as authentication tokens
and secrets) we have adopted the `.env` approach to feed the vulnerable data to
different components of the platform.

This approach requires the `dotenv` module (which is installed by running the
`npm install` command) and an `.env` file saved in this folder. One must create the
`.env` file by hand since it is ignored in the project.

### .env
What follows is an example of the `.env` file. To get the right tokens contact
one of the developers contributing to this project.


```bash
#######################################
### Production variables
#######################################

# postgres database password
PROD_PG_PASSWORD=postgres-password

# postgres database options
PROD_PG_SCHEMA=postgres-database-schema(optional)
PROD_PG_VERSION=postgres-database-version(optional)

# kafka messaging system options
PROD_KAFKA_HOST=kafka-host-ip(optional)
PROD_KAFKA_GROUP=kafka-group(optional)

PROD_ELASTICSEARCH_NODE=http://127.0.0.1:9200

#######################################
### Development variables
#######################################

# postgres database password
DEV_PG_PASSWORD=postgres-password

# postgres database options
DEV_PG_SCHEMA=postgres-database-schema(optional)
DEV_PG_VERSION=postgres-database-version(optional)

# kafka messaging system options
DEV_KAFKA_HOST=kafka-host-ip(optional)
DEV_KAFKA_GROUP=kafka-group(optional)

DEV_ELASTICSEARCH_NODE=http://127.0.0.1:9200

#######################################
### Test variables
#######################################

# postgres database password
TEST_PG_PASSWORD=postgres-password

# postgres database options
TEST_PG_SCHEMA=postgres-database-schema(optional)
TEST_PG_VERSION=postgres-database-version(optional)

# kafka messaging system options
TEST_KAFKA_HOST=kafka-host-ip(optional)
TEST_KAFKA_GROUP=kafka-group(optional)

TEST_ELASTICSEARCH_NODE=http://127.0.0.1:9200

######################################
# Common variables
######################################

# videolectures api key - for data retrieval
RETRIEVERS_VL_APIKEY=videolectures-apikey

# wikifier url and userkey - required for concept extraction
PREPROC_WIKIFIER_URL=http://www.wikifier.org
PREPROC_WIKIFIER_USERKEY=wikifier-userkey

# UPV MLLP-TTP
PREPROC_TTP_USER=ttp-user
PREPROC_TTP_TOKEN=ttp-token

# retriever tokens
TOKEN_VIDEOLECTURES=videolectures-token

```


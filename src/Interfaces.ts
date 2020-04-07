
export interface IGenericJSON { [key: string]: any; }
export type IGenericExecFunc = (value?: any) => any;
export type IGenericCallbackFunc = (error: Error, value?: any) => any;

export interface IProcessMaterial {
    title: string;
    description?: string;
    provider_uri: string;
    material_url: string;
    author?: string;
    language: string;
    creation_date?: string;
    retrieved_date: string;
    type: string;
    mimetype: string;
    material_metadata?: {
        wikipedia_concepts?: any;
        transcriptions?: any;
        raw_text?: string;
        metadata?: any;
        ttp_id: string;
    },
    provider: {
        token: string;
    },
    license: string;
}


/////////////////////////////////////////////////////////////////////
// Configuration Interfaces
/////////////////////////////////////////////////////////////////////

export interface IConfigRetriever {
    name: string;
    domain: string;
    script: string;
    token: string;
    config: any;
    [key: string]: any;
}

export interface IConfigCommon {
    environment: string;
    isProduction: boolean;
    retrievers: IConfigRetriever[];
    wikifier: {
        wikifierURL: string;
        userKey: string;
    }
    ttp: {
        user: string;
        token: string;
    }
}

export interface IConfigEnvironment {
    elasticsearch: {
        node: string;
    }
    kafka: {
        host: string;
        groupId: string;
    }
    pg: {
        host: string;
        port: number;
        database: string;
        max: number;
        idleTimeoutMillis: number;
        user: string;
        password: string;
        schema: string;
        version: string;
    }
}

export interface IConfiguration {
    environment?: string;
    isProduction?: boolean;
    retrievers?: IConfigRetriever[];
    wikifier?: {
        wikifierURL: string;
        userKey: string;
    }
    ttp?: {
        user: string;
        token: string;
    }
    elasticsearch: {
        node: string;
    }
    kafka: {
        host: string;
        groupId: string;
    }
    pg: {
        host: string;
        port: number;
        database: string;
        max: number;
        idleTimeoutMillis: number;
        user: string;
        password: string;
        schema: string;
        version: string;
    }
}

/////////////////////////////////////////////////////////////////////
// Kafka Interfaces
/////////////////////////////////////////////////////////////////////

export interface IKafkaConsumerParams {
    host: string;
    topic: string;
    groupId: string;
    high_water: number;
    low_water: number;
}

/////////////////////////////////////////////////////////////////////
// PostgreSQL Interfaces
/////////////////////////////////////////////////////////////////////

export interface IPostgreSQLParams {
    user: string;
    database: string;
    password: string;
    host: string;
    port: number;
    max: number;
    idleTimeoutMillis: number;
}

export type IPostgreSQLBatchCallbackFunc = (error: Error, rows: any[], callback: IGenericCallbackFunc) => void;

/////////////////////////////////////////////////////////////////////
// JSON Validator Interfaces
/////////////////////////////////////////////////////////////////////

import * as jsonschema from "jsonschema";

export interface IValidatorSchemas {
    [key:string]: jsonschema.Schema;
}

/////////////////////////////////////////////////////////////////////
// Wikifier Interfaces
/////////////////////////////////////////////////////////////////////

export interface IWikifierParams {
    user_key: string;
    wikifier_url: string;
    max_length?: number;
}

export interface IWikiDataClass {
    itemID: string;
    [key: string]: string;
}

export interface IWikifierSupport {
    wFrom: number;
    wTo: number;
    chFrom: number;
    chTo: number;
    pMentionGivenSurface: number;
    pageRank: number;
}

export interface IWikifierAnnotation {
    title: string;
    url: string;
    lang: string;
    pageRank: number;
    cosine: number;
    secLang?: string;
    secTitle?: string;
    secUrl?: string;
    wikiDataClasses: IWikiDataClass[];
    wikiDataClassIds: string[];
    dbPediaTypes: string[];
    dbPediaIri: string;
    supportLen: number;
    support: IWikifierSupport[];
}

export interface IWikifierConcept {
    uri: string;
    name: string;
    secUri: string;
    secName: string;
    lang: string;
    wikiDataClasses: IWikiDataClass[];
    cosine: number;
    pageRank: number;
    dbPediaIri: string;
    supportLen: number;
}

export interface IWikifierResponse {
    annotations: IWikifierAnnotation[];
    spaces: string[];
    words: string[];
    [key: string]: any;
}

export type IWikifierTaskFunc = (error: Error, concepts: IWikifierConcept[]) => any;
export type IWikifierCreateTaskFunc = (callback: IWikifierTaskFunc) => Promise<any>;

export interface IWikifierExtract {
    wikipedia: IWikifierConcept[];
    language: string;
}

export interface IWikifierConceptMapping {
    [key: string]: IWikifierConcept;
}

/////////////////////////////////////////////////////////////////////
// Bolt interfaces
/////////////////////////////////////////////////////////////////////

import * as qtolopology from "qtopology";

///////////////////////////////////////
// Extract Text Raw
///////////////////////////////////////

export interface ITextractConfiguration {
    preserveLineBreaks?: boolean;
    preserveOnlyMultipleLineBreaks?: boolean;
    includeAltText?: boolean;
}

export interface IExtractTextRawConfig {
    onEmit?: qtolopology.BoltEmitCallbackAsync;
    document_location_path: string;
    document_text_path: string;
    document_error_path?: string;
    document_location_type?: string;
    textract_config?: {
        preserve_line_breaks?: boolean;
        preserve_only_multiple_line_breaks?: boolean;
        include_alt_text?: boolean;
    }
}

///////////////////////////////////////
// Extract Text TTP
///////////////////////////////////////

export interface ITTPLanguageText {
    [key: string]: {
        tlpath?: { "l": string }[]
    };
}

export interface ITTPLanguageVideo {
    [key: string]: {
        sub: {
            tlpath?: {"l": string }[]
        }
    };
}

export interface ITTPIngestNewResponse {
    rcode: number;
    id: string;
}

export interface IExtractTextTTPConfig {
    onEmit?: qtolopology.BoltEmitCallbackAsync;
    ttp: {
        user: string;
        token: string;
        url?: string;
        languages: ITTPLanguageText;
        formats: {
            [key: number]: string;
        }
        timeout_millis: number;
    }
    temporary_folder: string;
    document_language_path: string;
    document_title_path: string;
    document_text_path: string;
    document_transcriptions_path: string;
    document_error_path?: string;
    ttp_id_path: string;
}


export interface IExtractVideoTTPConfig {
    onEmit?: qtolopology.BoltEmitCallbackAsync;
    ttp: {
        user: string;
        token: string;
        url?: string;
        languages: ITTPLanguageVideo;
        formats: {
            [key: number]: string;
        }
        timeout_millis: number;
    }
    document_language_path: string;
    document_location_path: string;
    document_authors_path: string;
    document_title_path: string;
    document_text_path: string;
    document_transcriptions_path: string;
    document_error_path?: string;
    ttp_id_path: string;
}

export type IExtractTTPStatusFunc = (id: string) => Promise<{
        process_completed: boolean;
        status_info: string;
        process_id: string;
        status_code: number;
    }>

export interface IExtractTTPStatus {
    status_code: number;
    status_info: string;
}

///////////////////////////////////////
// Get Material Contents
///////////////////////////////////////

export interface IGetMaterialContentConfig {
    onEmit?: qtolopology.BoltEmitCallbackAsync;
    document_text_path: string;
    document_error_path: string;
    pg: {
        host: string;
        port: number;
        database: string;
        max: number;
        idleTimeoutMillis: number;
        user: string;
        password: string;
        schema: string;
        version: string;
    }
}

///////////////////////////////////////
// Extract Wikipedia
///////////////////////////////////////

export interface IExtractWikipediaConfig {
    onEmit?: qtolopology.BoltEmitCallbackAsync;
    wikifier: {
        user_key: string;
        wikifier_url?: string;
        max_length?: number;
    }
    document_text_path: string;
    wikipedia_concept_path: string;
    document_error_path?: string;
}

///////////////////////////////////////
// Message Forward Kafka
///////////////////////////////////////

export type IFormatMessage = (message: IProcessMaterial) => IGenericJSON;

export interface IMessageForwardKafka {
    onEmit?: qtolopology.BoltEmitCallbackAsync;
    kafka: {
        host: string;
        topic: string;
    }
    format_message?: IFormatMessage
}


///////////////////////////////////////
// Message Logging
///////////////////////////////////////

export interface IMessageLoggingConfig {
    onEmit?: qtolopology.BoltEmitCallbackAsync;
    logging: {
        file_name: string;
        level: string;
        sub_folder: string;
        archive: boolean;
        message_type: string;
    },
    final_bolt?: boolean;
}

///////////////////////////////////////
// Message PostgreSQL
///////////////////////////////////////

export interface IMessagePostgreSQLConfig {
    onEmit?: qtolopology.BoltEmitCallbackAsync;
    pg: {
        host: string;
        port: number;
        database: string;
        max: number;
        idleTimeoutMillis: number;
        user: string;
        password: string;
        schema: string;
        version: string;
    }
    postgres_table: string;
    postgres_method?: string;
    postgres_primary_id: string;
    postgres_message_attrs?: IGenericJSON;
    postgres_time_attrs?: IGenericJSON;
    postgres_literal_attrs?: IGenericJSON;
    message_primary_id: string;
    final_bolt?: boolean;
    document_error_path?: string;
}

///////////////////////////////////////
// Message Validate
///////////////////////////////////////

export interface IMessageValidateConfig {
    onEmit?: qtolopology.BoltEmitCallbackAsync;
    json_schema: jsonschema.Schema;
    document_error_path?: string;
}

///////////////////////////////////////
// Store XXXXXXXXXXX
///////////////////////////////////////

export interface IStoreConfig {
    onEmit?: qtolopology.BoltEmitCallbackAsync;
    pg: {
        host: string;
        port: number;
        database: string;
        max: number;
        idleTimeoutMillis: number;
        user: string;
        password: string;
        schema: string;
        version: string;
    },
    final_bolt?: boolean;
}
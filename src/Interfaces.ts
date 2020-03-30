
export interface IGenericCallbackFunc {
    (error: Error, value?: any): any
}

export interface IGenericExecFunc {
    (value?: any): any
}

export interface IGenericJSON {
    [key: string]: any;
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
        idleTimeoutMillis: string;
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
        idleTimeoutMillis: string;
        user: string;
        password: string;
        schema: string;
        version: string;
    }
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

export interface IPostgreSQLBatchCallbackFunc {
    (error: Error, rows: any[], callback: IGenericCallbackFunc): void;
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

export interface IKafkaProducerParams {

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

export interface IWikifierTaskFunc {
    (error: Error, concepts: IWikifierConcept[]): any;
}

export interface IWikifierCreateTaskFunc {
    (callback: IWikifierTaskFunc): Promise<any>;
}

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


///////////////////////////////////////
// Extract Text Raw
///////////////////////////////////////

export interface ITextractConfiguration {
    preserveLineBreaks?: boolean;
    preserveOnlyMultipleLineBreaks?: boolean;
    includeAltText?: boolean;
}

export interface IExtractTextRawConfig {
    onEmit?: any;
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
// Get Material Contents
///////////////////////////////////////

export interface IGetMaterialContentConfig {
    onEmit?: any;
    document_text_path: string;
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
    onEmit?: any;
    wikifier: {
        user_key: string;
        wikifier_url?: string;
        max_length?: number;
    }
    document_text_path: string;
    wikipedia_concept_path: string;
    document_error_path?: string;
}
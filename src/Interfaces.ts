



export interface ITextractConfiguration {
    preserveLineBreaks?: boolean,
    preserveOnlyMultipleLineBreaks?: boolean,
    includeAltText?: boolean
}


export interface IExtractTextRawConfig {
    onEmit?: any,
    document_location_path: string,
    document_text_path: string,
    document_error_path?: string,
    document_location_type?: string,
    textract_config?: {
        preserve_line_breaks?: boolean
        preserve_only_multiple_line_breaks?: boolean,
        include_alt_text?: boolean
    }
}

export interface IGetMaterialContent {
    onEmit?: any,
    document_text_path: string,
    pg: {
        host: string,
        port: number,
        database: string,
        max: number,
        idleTimeoutMillis: number,
        user: string,
        password: string,
        schema: string,
        version: string
    }
}
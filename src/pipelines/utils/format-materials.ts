
import * as Interfaces from "../../Interfaces";

// formats completed materials
export function formatMaterialComplete (material: Interfaces.IProcessMaterial) {
    // split the material into pieces and send the data in the correct order
    const {
        title,
        description,
        provider_uri,
        material_url,
        author,
        language: origin_language,
        creation_date,
        retrieved_date,
        type,
        mimetype,
        material_metadata: {
            wikipedia_concepts,
            transcriptions,
            raw_text,
            metadata,
            ttp_id
        },
        provider: {
            token: provider_token
        },
        license
    } = material;

    // /////////////////////////////////////////
    // PREPARE MATERIAL AUTHORS
    // /////////////////////////////////////////

    let authors_copy: string[];

    if (author) {
        authors_copy = author
            .replace(/[{\"}]/g, "")
            .split(",")
            .map(str => str.trim());
        if (authors_copy.length === 1 && authors_copy[0] === "") {
            authors_copy = null;
        }
    }

    // /////////////////////////////////////////
    // PREPARE MATERIAL CONTENTS
    // /////////////////////////////////////////

    let material_contents = [];
    // prepare list of material contents
    if (transcriptions) {
        let languages = Object.keys(transcriptions);
        for (let language of languages) {
            let extensions = Object.keys(transcriptions[language]);
            for (let extension of extensions) {
                // get value of the language and extension
                const value = transcriptions[language][extension];

                // define the type of the transcriptions
                const type = language === origin_language
                    ? "transcription"
                    : "translation";

                material_contents.push({
                    language,
                    type,
                    extension,
                    value: { value },
                    material_id: null,
                    last_updated: null
                });
            }
        }
    } else if (raw_text) {
        // prepare the material content object
        material_contents.push({
            language: origin_language,
            type: "transcription",
            extension: "plain",
            value: { value: raw_text },
            material_id: null,
            last_updated: null
        });
    }

    // /////////////////////////////////////////
    // PREPARE FEATURES PUBLIC
    // /////////////////////////////////////////

    // prepare of public feature - wikipedia concept
    let features_public = {
        name: "wikipedia_concepts",
        value: { value: wikipedia_concepts },
        re_required: true,
        record_id: null,
        last_updated: null
    };

    // /////////////////////////////////////////
    // SEND TO THE DATABASES
    // /////////////////////////////////////////

    return {
        oer_materials: {
            title,
            description,
            language: origin_language,
            authors: authors_copy,
            creation_date,
            retrieved_date,
            type: type.toLowerCase(),
            mimetype: mimetype.toLowerCase(),
            license,
            ttp_id,
            ...metadata && { metadata }
        },
        material_contents,
        features_public,
        urls: {
            provider_uri,
            material_url
        },
        provider_token
    };
}

// formats partial materials
export function formatMaterialPartial (material: Interfaces.IProcessMaterial) {
    // rebrand the attribute name
    let authorList: string[];
    if (material.author) {
        let authorList = material.author
            .replace(/[{\"}]/g, "")
            .split(",")
            .map(str => str.trim());
        if (authorList.length === 1 && authorList[0] === "") {
            authorList = null;
        }
    }
    // make the copy of the material
    const materialCopy = JSON.parse(JSON.stringify(material));

    materialCopy.authors = authorList;
    delete materialCopy.author;

    return {
        oer_materials_partial: materialCopy
    };
}
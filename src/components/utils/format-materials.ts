import * as Interfaces from "../../Interfaces";

// formats completed materials
export function formatMaterialComplete(material: Interfaces.IMessage) {
  // split the material into pieces and send the data in the correct order
  const {
    title,
    description,
    provider_uri,
    material_url,
    author,
    language: origin_language,
    language_detected,
    creation_date,
    retrieved_date,
    type,
    mimetype,
    material_metadata: {
      wikipedia_concepts,
      transcriptions,
      raw_text,
      metadata,
      ttp_id,
    },
    provider: { token: provider_token },
    license,
  } = material;

  // /////////////////////////////////////////
  // PREPARE MATERIAL AUTHORS
  // /////////////////////////////////////////

  let authors_copy: string[];

  if (author) {
    authors_copy = author
      .replace(/[{\"}]/g, "")
      .split(",")
      .map((str) => str.trim());
    if (authors_copy.length === 1 && authors_copy[0] === "") {
      authors_copy = null;
    }
  }

  // /////////////////////////////////////////
  // PREPARE MATERIAL CONTENTS
  // /////////////////////////////////////////

  const material_contents = [];
  // prepare list of material contents
  if (transcriptions) {
    for (const language of Object.keys(transcriptions)) {
      for (const extension of Object.keys(transcriptions[language])) {
        // get value of the language and extension
        const value = transcriptions[language][extension];

        // define the type of the transcriptions
        const contentType =
          language === origin_language ? "transcription" : "translation";

        material_contents.push({
          language,
          type: contentType,
          extension,
          value: { value },
          material_id: null,
          last_updated: null,
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
      last_updated: null,
    });
  }

  // /////////////////////////////////////////
  // PREPARE FEATURES PUBLIC
  // /////////////////////////////////////////

  // prepare of public feature - wikipedia concept
  const features_public = {
    name: "wikipedia_concepts",
    value: { value: wikipedia_concepts },
    re_required: true,
    record_id: null,
    last_updated: null,
  };

  // /////////////////////////////////////////
  // SEND TO THE DATABASES
  // /////////////////////////////////////////

  return {
    oer_materials: {
      title,
      description,
      language: origin_language,
      language_detected,
      authors: authors_copy,
      creation_date,
      retrieved_date,
      type: type.toLowerCase(),
      mimetype: mimetype.toLowerCase(),
      license,
      ttp_id,
      ...(metadata && { metadata }),
    },
    material_contents,
    features_public,
    urls: {
      provider_uri,
      material_url,
    },
    provider_token,
  };
}

// formats partial materials
export function formatMaterialPartial(material: Interfaces.IMessage) {
  // rebrand the attribute name
  let authorCopy: string[];
  if (material.author) {
    authorCopy = material.author
      .replace(/[{\"}]/g, "")
      .split(",")
      .map((str) => str.trim());
    if (authorCopy.length === 1 && authorCopy[0] === "") {
      authorCopy = null;
    }
  }
  // make the copy of the material
  const materialCopy = JSON.parse(JSON.stringify(material));
  materialCopy.authors = authorCopy;
  materialCopy.provideruri = materialCopy.provider_uri;
  materialCopy.materialurl = materialCopy.material_url;
  materialCopy.type = { ext: materialCopy.type, mime: materialCopy.mimetype };
  materialCopy.datecreated = materialCopy.creation_date;
  materialCopy.dateretrieved = materialCopy.retrieved_date;
  materialCopy.materialmetadata = materialCopy.material_metadata;
  materialCopy.providertoken = materialCopy.provider.token;

  delete materialCopy.author;
  delete materialCopy.provider_uri;
  delete materialCopy.material_url;
  delete materialCopy.mimetype;
  delete materialCopy.creation_date;
  delete materialCopy.retrieved_date;
  delete materialCopy.material_metadata;
  delete materialCopy.provider;
  return {
    oer_materials_partial: materialCopy,
  };
}

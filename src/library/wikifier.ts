// interfaces
import * as Interfaces from "../Interfaces";

// modules
import * as async from "async";
import * as bent from "bent";

export default class Wikifier {

    private _userKey: string;
    private _wikifierURL: string;
    private _maxLength: number;
    private _postRequest: bent.BentResponse;

    // creates the wikifier instance
    constructor(config: Interfaces.IWikifierParams) {
        this._userKey = config.user_key;
        this._wikifierURL = config.wikifier_url || "http://www.wikifier.org";
        this._maxLength = config.max_length && config.max_length > 20000
            ? 20000
            : config.max_length || 10000;
        // prepare the POST request object
        this._postRequest = bent(this._wikifierURL, "POST", "json", 200);
    }


    // processes the text
    async processText(text: string) {
        let self = this;

        // separate text and prepare tasks for retrieving wiki concepts
        let tasks = self._prepareWikifierTasks(text, self._maxLength);

        if (tasks.length === 0) {
            // there is nothing to extract - return empty objects
            return Promise.reject(new Error("No tasks produced for text"));
        }

        // create the parallel processing promise
        let getWikipediaConcepts: Promise<Interfaces.IWikifierExtract> = new Promise((resolve, reject) => {
            // get wikipedia concepts from text
            async.parallelLimit(tasks, 5, (error, concepts) => {
                // reject the process if if doesn't go through
                if (error) { return reject(error); }
                if (concepts.length === 0) {
                    // there were no concepts extracted
                    return reject(new Error("No concepts were extracted"));
                }
                // merge the returned wikipedia concepts
                const wikipedia = self._mergeWikipediaConcepts(concepts);
                const language = self._getDominantLanguage(wikipedia)[0];

                // return the statistics
                return resolve({ wikipedia, language });
            });
        });
        // return the promise of the wikipedia concepts
        return await getWikipediaConcepts;
    }

    // ///////////////////////////////////////////
    // Helper methods
    // ///////////////////////////////////////////


    // annotate provided text with wikipedia concepts
    async _createRequest(text: string) {
        return await this._postRequest("/annotate-article", {
            text,
            lang: "auto",
            support: true,
            ranges: false,
            includeCosines: true,
            userKey: this._userKey,
            nTopDfValuesToIgnore: 50,
            nWordsToIgnoreFromList: 50
        });
    }


    // extract and weight the wikipedia concepts
    async _getWikipediaConcepts(text: string, weight: number) {
        try {
            // make wikipedia concept request and handle concepts
            let data: Interfaces.IWikifierResponse = await this._createRequest(text);
            // get annotations
            let { annotations } = data;

            if (!annotations || !annotations.length) {
                throw new Error("No annotations found for text");
            }

            ///////////////////////////////////////////////
            // Get top wikipedia concepts
            ///////////////////////////////////////////////

            // sort annotations by pageRank
            annotations.sort((anno1, anno2) =>
                anno2.pageRank - anno1.pageRank
            );

            // calculate the total pagerank from all concepts
            let totalSum = annotations.reduce((sum, concept) =>
                sum + concept.pageRank ** 2,
                0
            );

            // Noise reduction: get top 80% concepts
            let partialSum = 0;
            for (let i = 0; i < annotations.length; i++) {
                let annotation = annotations[i];
                partialSum += annotation.pageRank ** 2;
                if (partialSum / totalSum > 0.8) {
                    // we found the top 80% concepts describing the text
                    annotations = annotations.slice(0, i + 1);
                    break;
                }
            }

            ///////////////////////////////////////////////
            // Format wikipedia concepts
            ///////////////////////////////////////////////

            let concepts = annotations.map((concept) => ({
                uri: concept.url.toString(),
                name: concept.title.toString(),
                secUri: concept.secUrl || null,
                secName: concept.secTitle || null,
                lang: concept.lang,
                wikiDataClasses: concept.wikiDataClasses,
                cosine: concept.cosine * weight,
                pageRank: concept.pageRank * weight,
                dbPediaIri: concept.dbPediaIri,
                supportLen: concept.supportLen
            }));

            return concepts;
        } catch (error) {
            throw error;
        }
    }


    // prepares the text for wikification by splitting into smaller chunks
    _prepareWikifierTasks(text: string, maxLength: number) {
        let self = this;

        // creates the material enriching task function
        function _createWikifierTask(chunk: string, weight: number) {
            return (callback: Interfaces.IWikifierTaskFunc) =>
                // get the enriched materials
                self._getWikipediaConcepts(chunk, weight)
                    .then((concepts) => callback(null, concepts))
                    // if there is an error, return an empty array
                    .catch(() => callback(null, []));
        }

        // set placeholders
        let tasks: Interfaces.IWikifierCreateTaskFunc[] = [];
        let textIndex = 0;

        while (text.length > textIndex) {
            // get the text chunk
            let chunk = text.substring(textIndex, textIndex + maxLength);
            // there is not text to be processed, break the cycle
            if (chunk.length === 0) { break; }

            if (chunk.length === maxLength) {
                // handle how to split the chunk so that we don't cut in the middle of the sentence
                let cutIndex: number;
                // find the end of the sentence characters
                const endOfSentence = chunk.match(/[\.?!]/gi);
                if (endOfSentence) {
                    const lastCharIndex = endOfSentence.length - 1;
                    cutIndex = chunk.lastIndexOf(endOfSentence[lastCharIndex]);
                }
                // if there is not end character detected find last space char
                if (!cutIndex) { cutIndex = chunk.lastIndexOf(" "); }
                // if there is not space detected just take the whole chunk
                if (!cutIndex) { cutIndex = chunk.length; }
                // modify the chunk to contain whole sentences (if possible)
                chunk = chunk.substring(0, cutIndex);
                // increment text index
                textIndex += cutIndex;
            } else {
                // we got to the last chunk
                textIndex += maxLength;
            }
            // calculate the ratio that the found wikipedia concepts
            // will provide to the whole list of wikipedia concepts
            let weight = chunk.length / text.length;
            // add a new wikification task
            tasks.push(_createWikifierTask(chunk, weight));
        }
        return tasks;
    }


    // merges the wikipedia concepts extracted via the text chunks
    _mergeWikipediaConcepts(wikipediaConcepts: Interfaces.IWikifierConcept[][]) {
                // wikipedia concepts storage
        const conceptMapping: Interfaces.IWikifierConceptMapping = { };
        // merge concepts with matching uri
        for (const wikiBundle of wikipediaConcepts) {
            if (typeof wikiBundle[Symbol.iterator] !== "function") {
                continue;
            }
            for (const concept of wikiBundle) {
                if (conceptMapping[concept.uri]) {
                    // concept exists in mapping - add weighted pageRank
                    conceptMapping[concept.uri].pageRank += concept.pageRank;
                    conceptMapping[concept.uri].cosine += concept.cosine;
                    conceptMapping[concept.uri].supportLen += concept.supportLen;
                } else {
                    //  add concept to the mapping
                    conceptMapping[concept.uri] = concept;
                }
            }
        }
        // return the wikipedia concepts
        return Object.values(conceptMapping);
    }


    // get the dominant language found in the wikipedia concepts
    _getDominantLanguage(concepts: Interfaces.IWikifierConcept[]) {
        // get the dominant language of the material
        const languages: { [key: string]: number } = { };
        for (const concept of concepts) {
            if (!languages[concept.lang]) {
                languages[concept.lang] = 0;
            }
            languages[concept.lang] += 1;
        }
        // get the maximum language
        return Object.entries(languages).reduce((a, b) =>
            a[1] > b[1] ? a : b,
            [null, 0]
        );
    }
}
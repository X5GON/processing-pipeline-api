/** ********************************************************
 * Videolectures API
 * This class is used to retrieve lecture metadata
 * from Videolectures.NET.
 */

// interfaces
import * as Interfaces from "../Interfaces";
import PostgreSQL from "../library/postgresQL";

// modules
import RestBasic from "./api-rest-basic";
import got from "got";

export default class VideolecturesAPI extends RestBasic {

    private _domain: string;
    private _apikey: string;
    private _token: string;

    private _pg: PostgreSQL;

    constructor(args: Interfaces.IConfigRetriever) {
        super();
        // set retriever parameters
        this._domain = "http://videolectures.net";
        this._apikey = args.apikey;
        this._token = args.token;
        this._pg = args.pg;
    }


    // get the material via URL
    async getMaterial(url: string) {

        if (!url) {
            throw new Error("[VideolecturesAPI.getMaterial] url not provided");
        }
        // extract the slug from the full material provider
        const slug = url.split("/")[3];
        // setup the url to get the videolectures metadata
        const response = await got(`${this._domain}/site/api/lectures?apikey=${this._apikey}&slug=${slug}`);
        const lecture: any = response.body;
        if (!lecture || (!lecture.results && !lecture.results[0])) {
            throw new Error(`[VideolecturesAPI.getMaterial] lecture not found for url=${url}`);
        }

        const materialRequests = [];

        const materials = lecture.results[0];
        for (const video of materials.videos) {
            const videoURL = `${this._domain}/site/api/videos/${video.id}?apikey=${this._apikey}`;
            materialRequests.push(got(videoURL));
        }
            // return the material requests
        const contents = await Promise.all(materialRequests);
        if (!contents) {
            throw new Error(`[VideolecturesAPI.getMaterial] no content found for url=${url}`);
        }

        // create a container for oer materials
        const oerList = [];
        for (let attachments of contents) {
            attachments = attachments.body;
            for (const file of attachments.attachments) {
                const display = file.type_display;
                if (display && (display.includes("Slide Presentation") || display.includes("generic video source"))) {
                    const oerMaterials = this._prepareMaterial({ materials, file, part: attachments.part });
                    // check if the material is already in the database
                    const isPresent = await this._pg.select({ url: oerMaterials.material_url }, "material_process_queue");
                    if (isPresent.length === 0) {
                        oerList.push(oerMaterials);
                    }
                }
            }
        }
        // get all materials and filter out the empty ones
        return oerList.filter((material) => material);
    }

    start() {
        // mandatory placeholder
    }

    stop() {
        // mandatory placeholder
    }

    update() {
        // mandatory placeholder
    }

    // /////////////////////////////////////////////////////
    // Helper Functions
    // /////////////////////////////////////////////////////

    // formats the videolecture material
    _prepareMaterial(params: any) {
        // get material metadata
        const {
            materials: {
                title,
                description,
                slug,
                authors,
                language,
                time
            },
            file: {
                src
            },
            part
        } = params;

        // fix mimetype and extension if required
        const mimetype = params.file.mimetype || super.mimetype(src);
        const ext = params.file.ext || super.extension(mimetype);

        // return the material object
        return {
            title,
            description,
            provider_uri: `${this._domain}/${slug}/`,
            material_url: src,
            author: authors.join(","),
            language,
            type: {
                ext,
                mime: mimetype
            },
            date_created: time,
            retrieved_date: (new Date()).toISOString(),
            provider_token: this._token,
            material_metadata: {
                metadata: {
                    slug,
                    part
                }
            },
            license: "https://creativecommons.org/licenses/by-nc-nd/3.0/"
        };
    }
}


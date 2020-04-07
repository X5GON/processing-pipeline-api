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
import * as bent from "bent";

export default class VideolecturesAPI extends RestBasic {

    private _domain: string;
    private _apikey: string;
    private _token: string;

    private _pg: PostgreSQL;
    private _getRequest: bent.RequestFunction<any>;

    constructor(args: Interfaces.IConfigRetriever) {
        super();
        // set retriever parameters
        this._domain = "http://videolectures.net";
        this._apikey = args.apikey;
        this._token = args.token;
        this._pg = args.pg;
        // prepare the GET request object
        this._getRequest = bent(this._domain, "GET", "json", 200);
    }


    // get the material via URL
    async getMaterial(url: string) {

        if (!url) {
            throw new Error("[VideolecturesAPI.getMaterial] url not provided");
        }
        // extract the slug from the full material provider
        const slug = url.split("/")[3];
        // setup the url to get the videolectures metadata
        const lecture = await this._getRequest(`/site/api/lectures?apikey=${this._apikey}&slug=${slug}`);

        if (!lecture || (!lecture.results && !lecture.results[0])) {
            throw new Error(`[API-Videolectures get] lecture not found for url=${url}`);
        }

        const materialRequests = [];

        const materials = lecture.results[0];
        for (const video of materials.videos) {
            const videoURL = `/site/api/videos/${video.id}?apikey=${this._apikey}`;
            materialRequests.push(this._getRequest(videoURL));
        }
            // return the material requests
        const contents = await Promise.all(materialRequests);
        if (!contents) {
            throw new Error(`[API-Videolectures get] no content found for url=${url}`);
        }

        // create a container for oer materials
        const oerList = [];
        for (const attachments of contents) {
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


// JSONs
import * as mimetypes from "../../config/mimetypes.json";
// modules
import BasicBolt from "./basic-bolt";
import * as Interfaces from "../../Interfaces";


class MessageRedirect extends BasicBolt {

    constructor() {
        super();
        this._name = null;
        this._onEmit = null;
        this._context = null;
    }

    async init(name: string, config: any, context: any) {
        this._name = name;
        this._context = context;
        this._onEmit = config.onEmit;
        this._prefix = `[MessageRedirect ${this._name}]`;
    }

    heartbeat() {
        // do something if needed
    }

    async shutdown() {
        // shutdown component
    }

    async receive(material: Interfaces.IProcessMaterial, stream_id: string) {
        let {
            mimetype,
            retrieved_date
        } = material;

        let date = new Date(retrieved_date);
        // check if the video and audio materials were retrieved before 2019-07-01
        let limitDate = new Date("2019-08-01");
        if (date >= limitDate) {
            stream_id = "updated";
        } else if (mimetypes.video.includes(mimetype)) {
            stream_id = "video";
        } else if (mimetypes.audio.includes(mimetype)) {
            stream_id = "video";
        } else if (mimetypes.text.includes(mimetype)) {
            stream_id = "text";
        }

        // redirect the material
        return await this._onEmit(material, stream_id);
    }
}
// create a new instance of the bolt
const create = () => new MessageRedirect();

export { create };

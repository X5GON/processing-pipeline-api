/** ******************************************************************
 * Material Format Component
 * This component receives the OER material in its raw form and it
 * formats into a common schema.
 */

// interfaces
import * as winston from "winston";
import * as Interfaces from "../../Interfaces";

// modules
import BasicBolt from "./basic_bolt";
import Logger from "../../library/logger";


class MsgLoggingBolt extends BasicBolt {

    private _logger: winston.Logger;
    private _logger_message_type: string;
    private _finalBolt: boolean;

    constructor() {
        super();
        this._name = null;
        this._onEmit = null;
        this._context = null;
    }

    async init(name: string, config: Interfaces.IMsgLoggingBoltConfig, context: any) {
        this._name = name;
        this._context = context;
        this._onEmit = config.onEmit;
        this._prefix = `[MsgLoggingBolt ${this._name}]`;

        const {
            logging: {
                file_name,
                level,
                sub_folder,
                archive,
                message_type
            },
            final_bolt
        } = config;

        this._logger_message_type = message_type;
        // initialize the logger
        this._logger = Logger.createInstance(file_name, level, sub_folder, false, archive);
        // if this is the final bolt in the pipeline
        this._finalBolt = final_bolt;
    }

    heartbeat() {
        // do something if needed
    }

    async shutdown() {
        // prepare for graceful shutdown, e.g. save state
    }

    async receive(message: any, stream_id: string) {
        // do not change any requests and log the message
        this._logger.info(this._logger_message_type, message);
        // send the formatted material to next component
        return this._finalBolt ? null : await this._onEmit(message, stream_id);
    }
}

// create a new instance of the bolt
const create = () => new MsgLoggingBolt();

export { create };

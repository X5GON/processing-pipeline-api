/** **********************************************
 * Kafka Consumer Spout
 * This component is listening to a Kafka topic
 * and then sends the message forward to the next
 * component in the topology.
 */

// interfaces
import * as qtopology from "qtopology";

// modules
import BasicSpout from "./basic-spout";
import KafkaConsumer from "../../library/kafka-consumer";

/**
 * @class KafkaSpout
 * @description Retrieves the messages provided by a Kafka topic and forwards it
 * to the next component of the topology.
 */
class KafkaSpout extends BasicSpout {

    private _generator: KafkaConsumer;

    constructor() {
        super();
        this._name = null;
        this._context = null;
        this._prefix = "";
        this._generator = null;
    }

    init(name: string, config: any, context: any, callback: qtopology.SimpleCallback) {
        this._name = name;
        this._context = context;
        this._prefix = `[KafkaSpout ${this._name}]`;
        this._generator = new KafkaConsumer({
            host: config.kafka_host,
            topic: config.topic,
            groupId: config.group_id,
            high_water: config.high_water,
            low_water: config.low_water
        });
        callback();
    }

    heartbeat() {
        // do something if needed
    }

    shutdown(callback: qtopology.SimpleCallback) {
        // stop kafka generator
        this._generator.stop(callback);
    }

    run() {
        // enable kafka generator
        this._generator.enable();
    }

    pause() {
        // disable kafka generator
        this._generator.disable();
    }

    next(callback: qtopology.SpoutNextCallback) {
        // get the next message from the kafka message
        const message = this._generator.next();
        callback(null, message, null);
    }
}

const create = function () {
    return new KafkaSpout();
}

export { create };

/** **********************************************
 * Kafka Consumer Spout
 * This component is listening to a Kafka topic
 * and then sends the message forward to the next
 * component in the topology.
 */

// modules
import BasicSpout from "./basic-spout";
import KafkaConsumer from "../../library/kafka-consumer";


class KafkaSpout extends BasicSpout {

    private _generator: KafkaConsumer;

    constructor() {
        super();
        this._name = null;
        this._context = null;
        this._prefix = "";
        this._generator = null;
    }

    async init(name: string, config: any, context: any) {
        this._name = name;
        this._context = context;
        this._prefix = `[KafkaSpout ${this._name}]`;
        this._generator = new KafkaConsumer(config.kafka);
    }

    heartbeat() {
        // do something if needed
    }

    async shutdown() {
        // stop kafka generator
        const promise = new Promise((resolve, reject) => {
            this._generator.stop(() => {
                return resolve();
            });
        });
        await promise;
    }

    run() {
        // enable kafka generator
        this._generator.enable();
    }

    pause() {
        // disable kafka generator
        this._generator.disable();
    }

    async next() {
        const message = this._generator.next();
        // get the next message from the generator
        return message ? { data: message } : null;
    }
}

// create a new instance of the spout
const create = () => new KafkaSpout();

export { create };

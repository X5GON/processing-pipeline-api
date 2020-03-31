/** **********************************************
 * Kafka Producer Module
 * This module creates a kafka producer which
 * can create new messages and send them to
 * the assigned kafka topic.
 */

// interfaces
import * as Interfaces from "../Interfaces";

// modules
import * as k from "kafka-node";


export default class KafkaProducer {

    private _ready: boolean;
    private _payloads: k.ProduceRequest[][];
    private _producer: k.HighLevelProducer;

    // initialize a kafka producer
    constructor(host: string) {

        const options: k.KafkaClientOptions = {
            kafkaHost: host
        };

        this._ready = false;
        this._payloads = [];
        const client = new k.KafkaClient(options);
        // create a kafka producer
        this._producer = new k.HighLevelProducer(client);

        // make the producer ready
        this._producer.on("ready", () => {
            this._ready = true;
            // check if there are any messages not sent
            if (this._payloads.length) {
                // send all messages to the appropriate
                while (this._payloads.length) {
                    // get the first element from the array of messages
                    const message = this._payloads[0];
                    // update the messages array
                    this._payloads = this._payloads.slice(1);
                    // send the message to the corresponsing topic
                    this._producer.send(message, (xerror, data) => {
                        if (xerror) { console.log(xerror); }
                    });
                }
            }
        });
    }

    // sends the message to the appropirate topic
    send(topic: string, msg: any, cb: Interfaces.IGenericCallbackFunc) {
        // get set callback value
        const callback = cb && typeof (cb) !== "function"
            ? (error: Error) => { if (error) { console.log(error); } }
            : cb;

        // prepare the message in string
        const messages = JSON.stringify(msg);
        const payload: k.ProduceRequest[] = [{ topic, messages }];
        if (this._ready) {
            // the producer is ready to send the messages
            this._producer.send(payload, (error, data) => {
                if (error) { return callback(error); }
                return callback(null);
            });
        } else {
            // store the topic and message to send afterwards
            this._payloads.push(payload);
            return callback(null);
        }
    }
}

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
    private _messages: any[];
    private _producer: k.HighLevelProducer;

    // initialize a kafka producer
    constructor(host: string) {

        const options: k.KafkaClientOptions = {
            kafkaHost: host
        };

        this._ready = false;
        this._messages = [];
        const client = new k.KafkaClient(options);
        // create a kafka producer
        this._producer = new k.HighLevelProducer(client);

        // make the producer ready
        this._producer.on("ready", () => {
            this._ready = true;
            // check if there are any messages not sent
            if (this._messages.length) {
                // send all messages to the appropriate
                while (this._messages.length) {
                    // get the first element from the array of messages
                    const message = this._messages[0];
                    // update the messages array
                    this._messages = this._messages.slice(1);
                    // send the message to the corresponsing topic
                    this._producer.send([message], (xerror, data) => {
                        if (xerror) { console.log(xerror); }
                    });
                }
            }
        });
    }

    // sends the message to the appropirate topic
    send(topic: string, msg: any, cb: Interfaces.IGenericCallbackFunc) {
        let self = this;

        // get set callback value
        let callback = cb && typeof (cb) !== "function"
            ? (error: Error) => { if (error) { console.log(error); } }
            : cb;

        // prepare the message in string
        const messages = JSON.stringify(msg);
        const payload = [{ topic, messages }];
        if (self._ready) {
            // the producer is ready to send the messages
            self._producer.send(payload, (error, data) => {
                if (error) { return callback(error); }
                return callback(null);
            });
        } else {
            // store the topic and message to send afterwards
            self._messages.push(payload);
            return callback(null);
        }
    }
}

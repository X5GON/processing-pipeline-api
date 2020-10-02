/** **********************************************
 * Kafka Producer Module
 * This module creates a kafka producer which
 * can create new messages and send them to
 * the assigned kafka topic.
 */

// interfaces
import * as Interfaces from "../Interfaces";

// modules
import { Kafka, Producer } from "kafkajs";

export default class KafkaProducer {

    private _kafka: Kafka;
    private _producer: Producer;
    private _ready: boolean;
    private _payloads: Interfaces.IKafkaProducerRequest[];

    // initialize a kafka producer
    constructor(clientId: string, host: string) {
        // create kafka connection
        this._kafka = new Kafka({
            clientId,
            brokers: [host]
        });
        // create a kafka producer
        this._producer = this._kafka.producer();
        // set metadata
        this._ready = false;
        this._payloads = [];
    }

    // connect to the kafka broker
    async connect() {
        await this._producer.connect();
        this._ready = true;
        if (this._payloads.length) {
            // send all messages to the appropriate
            while (this._payloads.length) {
                // get the first element from the array of messages
                const message = this._payloads[0];
                // update the messages array
                this._payloads = this._payloads.slice(1);
                // send the message to the corresponsing topic
                await this._producer.send(message);
            }
        }
        console.log("Kafka Producer Connected");
        return this._ready;
    }

    // disconnect from the broker
    async disconnect() {
        await this._producer.disconnect();
        this._ready = false;
        return this._ready;
    }

    // sends the message to the appropriate topic
    async send(topic: string, msg: any) {
        try {
            // prepare the message in string
            const messages = [{ value: JSON.stringify(msg) }];
            const payload: Interfaces.IKafkaProducerRequest = { topic, messages };
            if (this._ready) {
                await this._producer.send(payload);
            } else {
                // store the topic and message to send afterwards
                this._payloads.push(payload);
            }
            return true;
        } catch (e) {
            return false;
        }
    }
}

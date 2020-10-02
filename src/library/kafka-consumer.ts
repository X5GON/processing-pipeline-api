/** **********************************************
 * Kafka Consumer Module
 * This module creates a kafka consumer which
 * can be used to listen on a particular kafka
 * topic and receive its messages.
 */

// interfaces
import * as Interfaces from "../Interfaces";

// modules
import { Kafka, Consumer } from "kafkajs";

export default class KafkaConsumer {

    private _kafka: Kafka;
    private _consumer: Consumer;

    private _data: any[];
    private _topic: string;
    private _high_water: number;
    private _low_water: number;

    private _highWaterClearing: boolean;
    private _enabled: boolean;

    // Initialize the Kafka consumer instance
    constructor(params: Interfaces.IKafkaConsumerParams) {

        const {
            host,
            groupId,
            topic,
            clientId,
            high_water,
            low_water
        } = params;

        // create kafka connection
        this._kafka = new Kafka({
            clientId,
            brokers: [host]
        });

        // the message container
        this._data = [];
        this._topic = topic;
        this._high_water = high_water;
        this._low_water = low_water;

        this._consumer = this._kafka.consumer({ groupId });

        this._highWaterClearing = false;
        this._enabled = false;
    }

    // connect to the consumer
    async connect() {
        await this._consumer.connect();
        await this._consumer.subscribe({ topic: this._topic });
        await this._consumer.run({
            eachMessage: async ({ message }) => {
                const messageValue = message.value.toString();
                if (messageValue === "") { return; }
                this._data.push(JSON.parse(messageValue));

                if (this._data.length >= this._high_water) {
                    this._highWaterClearing = true;
                    this._consumer.pause([{ topic: this._topic }]);
                }
            }
        });
        this._enabled = true;
        return this._enabled;
    }

    // enables message consumption
    enable() {
        if (!this._enabled) {
            if (!this._highWaterClearing) {
                this._consumer.resume([{ topic: this._topic }]);
            }
            this._enabled = true;
        }
    }

    // disables message consumption
    disable() {
        if (this._enabled) {
            if (!this._highWaterClearing) {
                this._consumer.pause([{ topic: this._topic }]);
            }
            this._enabled = false;
        }
    }

    // get the next message
    next() {
        if (!this._enabled) {
            return null;
        }
        if (this._data.length > 0) {
            const msg = this._data[0];
            this._data = this._data.slice(1);
            if (this._data.length <= this._low_water) {
                this._highWaterClearing = false;
                this._consumer.resume([{ topic: this._topic }]);
            }
            return msg;
        } else {
            return null;
        }
    }
}

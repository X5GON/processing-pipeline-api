/** **********************************************
 * Kafka Consumer Module
 * This module creates a kafka consumer which
 * can be used to listen on a particular kafka
 * topic and receive its messages.
 */

// interfaces
import * as Interfaces from "../Interfaces";

// modules
import * as k from "kafka-node";


export default class KafkaConsumer {

    private _data: any[];
    private _high_water: number;
    private _low_water: number;

    private _consumerGroup: k.ConsumerGroup;
    private _highWaterClearing: boolean;
    private _enabled: boolean;

    // Initialize the Kafka consumer instance
    constructor(params: Interfaces.IKafkaConsumerParams) {

        const {
            host,
            topic,
            groupId,
            high_water,
            low_water
        } = params;

        // the message container
        this._data = [];

        this._high_water = high_water;
        this._low_water = low_water;

        // setup the consumer options
        const options: k.ConsumerGroupOptions = {
            kafkaHost: host,
            ssl: true,
            groupId,
            sessionTimeout: 15000,
            protocol: ["roundrobin"],
            fromOffset: "latest",
            fetchMaxBytes: 1024 * 2048,
            outOfRangeOffset: "earliest",
            migrateHLC: false,
            migrateRolling: true,
        };

        // initialize the consumer group and flags
        this._consumerGroup = new k.ConsumerGroup(options, [topic]);
        this._highWaterClearing = false;
        this._enabled = true;

        // setup the listener
        this._consumerGroup.on("message", (message) => {
            // get the message value and cast it to string
            const messageValue = message.value.toString();

            if (messageValue === "") { return; }
            // push the new message to the container
            this._data.push(JSON.parse(messageValue));

            // handle large amount of data
            if (this._data.length >= this._high_water) {
                this._highWaterClearing = true;
                this._consumerGroup.pause();
            }
        });
    }


    // enables message consumption
    enable() {
        if (!this._enabled) {
            if (!this._highWaterClearing) {
                this._consumerGroup.resume();
            }
            this._enabled = true;
        }
    }


    // disables message consumption
    disable() {
        if (this._enabled) {
            if (!this._highWaterClearing) {
                this._consumerGroup.pause();
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
            let msg = this._data[0];
            this._data = this._data.slice(1);
            if (this._data.length <= this._low_water) {
                this._highWaterClearing = false;
                this._consumerGroup.resume();
            }
            return msg;
        } else {
            return null;
        }
    }


    // stop and closes the consumer group
    stop(cb: Interfaces.IGenericCallbackFunc) {
        this._consumerGroup.close(true, cb);
    }
}

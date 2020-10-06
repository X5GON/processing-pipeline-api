/** ******************************************************************
 * Forward Message to Kafka Topic
 * This component forwards the provided message to the
 * appropriate kafka topic and service.
 */

// interfaces
import * as Interfaces from "../../Interfaces";

// modules
import KafkaProducer from "../../library/kafka-producer";
import BasicBolt from "./basic-bolt";

/**
 * @class KafkaSender
 * @description Sends the messages to the corresponding kafka topic.
 */
class MessageForwardKafka extends BasicBolt {

    private _kafkaProducer: KafkaProducer;
    private _kafkaTopic: string;
    private _formatMessage: Interfaces.IFormatMessage;

    constructor() {
        super();
        this._name = null;
        this._onEmit = null;
        this._context = null;
    }

    async init(name: string, config: Interfaces.IMessageForwardKafka, context: any) {
        this._name = name;
        this._context = context;
        this._onEmit = config.onEmit;
        this._prefix = `[MessageForwardKafka ${this._name}]`;

        this._kafkaProducer = new KafkaProducer(config.kafka.clientId, config.kafka.host);
        await this._kafkaProducer.connect();

        this._kafkaTopic = config.kafka.topic;
        this._formatMessage = config.format_message;
    }

    heartbeat() {
        // do something if needed
    }

    async shutdown() {
        // shutdown component
        await this._kafkaProducer.disconnect();
    }

    async receive(message: any, stream_id: string) {
        if (this._formatMessage) {
            message = this._formatMessage(message);
        }
        await this._kafkaProducer.send(this._kafkaTopic, message);
        return;
    }
}

// create a new instance of the bolt
const create = () => new MessageForwardKafka();

export { create };

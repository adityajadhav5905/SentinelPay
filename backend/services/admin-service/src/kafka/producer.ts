import { Kafka, Producer } from 'kafkajs';

const KAFKA_BROKERS = (process.env.KAFKA_BOOTSTRAP_SERVERS || 'localhost:9092').split(',');

const kafka = new Kafka({
    clientId: 'admin-service',
    brokers: KAFKA_BROKERS,
    retry: {
        initialRetryTime: 100,
        retries: 8
    }
});

let producer: Producer;

export const connectKafka = async () => {
    try {
        producer = kafka.producer();
        await producer.connect();
        console.log('Admin Service connected to Kafka Producer');
    } catch (error) {
        console.error('Kafka Connection Error:', error);
    }
};

export const sendKafkaMessage = async (topic: string, message: any) => {
    if (!producer) {
        console.warn('Kafka producer not connected, attempting reconnection...');
        await connectKafka();
    }

    try {
        await producer.send({
            topic,
            messages: [
                { value: JSON.stringify(message) }
            ]
        });
        console.log(`Sent message to ${topic}`, message);
    } catch (error) {
        console.error(`Failed to send message to ${topic}:`, error);
        throw error;
    }
};

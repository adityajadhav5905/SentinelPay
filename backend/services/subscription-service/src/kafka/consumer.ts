import { Kafka, EachMessagePayload } from 'kafkajs';

const KAFKA_BROKERS = (process.env.KAFKA_BOOTSTRAP_SERVERS || 'localhost:9092').split(',');
const CLIENT_ID = process.env.SERVICE_NAME || 'subscription-service';
const GROUP_ID = `${CLIENT_ID}-group`;

export const startKafkaConsumer = async () => {
    const kafka = new Kafka({
        clientId: CLIENT_ID,
        brokers: KAFKA_BROKERS,
    });

    const consumer = kafka.consumer({ groupId: GROUP_ID });

    try {
        await consumer.connect();
        console.log(`✅ [${CLIENT_ID}] Kafka Consumer connected`);

        // Subscribe to transactions topic (defaulting to 'transactions' if not set)
        const topic = 'transactions';
        await consumer.subscribe({ topic, fromBeginning: false });
        console.log(`✅ [${CLIENT_ID}] Subscribed to topic: ${topic}`);

        await consumer.run({
            eachMessage: async ({ topic, partition, message }: EachMessagePayload) => {
                const prefix = `[${CLIENT_ID}]`;
                if (message.value) {
                    try {
                        const event = JSON.parse(message.value.toString());
                        console.log(`${prefix} 📥 Received Transaction: ${event.data?.tx_id || 'unknown'} | User: ${event.meta?.user_id} | Amount: ${event.data?.amount} ${event.data?.currency}`);
                    } catch (e) {
                        console.log(`${prefix} 📥 Received raw message: ${message.value.toString()}`);
                    }
                }
            },
        });
    } catch (error) {
        console.error(`❌ [${CLIENT_ID}] Failed to start consumer:`, error);
    }
};

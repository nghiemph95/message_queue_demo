const { Kafka } = require("kafkajs");
require("dotenv").config();

const kafka = new Kafka({
  clientId: "demo-consumer",
  brokers: [process.env.KAFKA_BROKER || 'kafka:29092'],
});

const consumer = kafka.consumer({ groupId: "test-group" });

async function run() {
  await consumer.connect();
  await consumer.subscribe({
    topic: process.env.KAFKA_TOPIC || 'test-topic',
    fromBeginning: true,
  });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      console.log({
        topic,
        partition,
        offset: message.offset,
        value: message.value.toString(),
      });
    },
  });
}

run().catch(console.error);
console.log('Kafka consumer is running...');

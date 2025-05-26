const amqp = require("amqplib");
require("dotenv").config();

const queue = process.env.RABBITMQ_QUEUE || 'test-queue';

async function run() {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq');
    const channel = await connection.createChannel();

    await channel.assertQueue(queue, { durable: false });

    console.log(`Waiting for messages in ${queue}. To exit press CTRL+C`);

    channel.consume(queue, (message) => {
      if (message !== null) {
        console.log({
          source: "RabbitMQ",
          message: message.content.toString(),
        });
        channel.ack(message);
      }
    });
  } catch (error) {
    console.error("Error in RabbitMQ consumer:", error);
    // Try to reconnect after 5 seconds if there's an error
    setTimeout(run, 5000);
  }
}

run();
console.log('RabbitMQ consumer is running...');

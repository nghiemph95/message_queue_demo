const { Kafka } = require("kafkajs");
const amqp = require("amqplib");
const express = require("express");
const bodyParser = require("body-parser");
require("dotenv").config();

const app = express();
app.use(bodyParser.json());

// Kafka setup
const kafka = new Kafka({
  clientId: "demo-producer",
  brokers: [process.env.KAFKA_BROKER || 'kafka:29092'],
});
const producer = kafka.producer();

// Connect to Kafka on startup
async function connectKafka() {
  try {
    await producer.connect();
    console.log('Connected to Kafka');
  } catch (error) {
    console.error('Failed to connect to Kafka:', error);
    setTimeout(connectKafka, 5000);
  }
}

connectKafka();

// Send message to Kafka
async function sendToKafka(message) {
  try {
    await producer.connect();
    await producer.send({
      topic: process.env.KAFKA_TOPIC || 'test-topic',
      messages: [{ value: message }],
    });
    console.log(`Sent to Kafka: ${message}`);
  } catch (error) {
    console.error("Error sending to Kafka:", error);
  } finally {
    // Don't disconnect after each send to avoid continuous connection errors
    // await producer.disconnect();
  }
}

// Send message to RabbitMQ
async function sendToRabbitMQ(message) {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq');
    const channel = await connection.createChannel();
    const queue = process.env.RABBITMQ_QUEUE || 'test-queue';
    await channel.assertQueue(queue, { durable: false });
    channel.sendToQueue(queue, Buffer.from(message));
    console.log(`Sent to RabbitMQ: ${message}`);
    
    // Close connection after sending
    setTimeout(() => {
      channel.close();
      connection.close();
    }, 500);
  } catch (error) {
    console.error("Error sending to RabbitMQ:", error);
  }
}

// API endpoints
app.post('/send', async (req, res) => {
  try {
    const { message, target } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    const timestamp = new Date().toISOString();
    const formattedMessage = `${message} at ${timestamp}`;
    
    if (!target || target === 'all') {
      // Send to both Kafka and RabbitMQ
      await sendToKafka(formattedMessage);
      await sendToRabbitMQ(formattedMessage);
      return res.json({ success: true, message: 'Message sent to both Kafka and RabbitMQ' });
    } else if (target === 'kafka') {
      // Send to Kafka only
      await sendToKafka(formattedMessage);
      return res.json({ success: true, message: 'Message sent to Kafka' });
    } else if (target === 'rabbitmq') {
      // Send to RabbitMQ only
      await sendToRabbitMQ(formattedMessage);
      return res.json({ success: true, message: 'Message sent to RabbitMQ' });
    } else {
      return res.status(400).json({ error: 'Invalid target. Use "kafka", "rabbitmq", or "all"' });
    }
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// API for health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Producer API running on port ${PORT}`);
  console.log('Send messages using POST /send with JSON body: { "message": "Your message", "target": "kafka|rabbitmq|all" }');
});

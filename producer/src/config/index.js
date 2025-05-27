/**
 * Cấu hình chung cho ứng dụng
 */
require("dotenv").config();

module.exports = {
  // Cấu hình Kafka
  kafka: {
    clientId: "demo-producer",
    brokers: [process.env.KAFKA_BROKER || "kafka:29092"],
    defaultTopic: process.env.KAFKA_TOPIC || "test-topic",
    transactionalId: "demo-transactional-producer",
  },

  // Cấu hình RabbitMQ
  rabbitmq: {
    url: process.env.RABBITMQ_URL || "amqp://guest:guest@rabbitmq",
    defaultQueue: process.env.RABBITMQ_QUEUE || "test-queue",
    defaultExchange: "",
    maxRetries: 10,
    retryDelay: 1000,
  },

  // Cấu hình server
  server: {
    port: process.env.PORT || 3000,
  },
};

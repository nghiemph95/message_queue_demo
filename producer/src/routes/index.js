/**
 * API Routes chính
 */
const express = require("express");
const router = express.Router();
const kafkaService = require("../services/kafka/kafka-service");
const rabbitMQService = require("../services/rabbitmq/rabbitmq-service");

/**
 * Health check endpoint
 * GET /health
 */
router.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

/**
 * Gửi tin nhắn đến Kafka hoặc RabbitMQ hoặc cả hai
 * POST /send
 */
router.post("/send", async (req, res) => {
  try {
    const { message, target, options } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Xử lý tin nhắn (chuỗi hoặc object)
    let processedMessage;
    if (typeof message === "string") {
      processedMessage = message;
    } else if (Array.isArray(message)) {
      processedMessage = message.map(msg => 
        typeof msg === "object" 
          ? { ...msg, timestamp: new Date().toISOString() }
          : msg
      );
    } else {
      // Nếu là object, thêm timestamp vào
      processedMessage = {
        ...message,
        timestamp: new Date().toISOString(),
      };
    }

    // Kết quả gửi tin nhắn
    const results = {};

    if (!target || target === "all") {
      // Gửi đến cả Kafka và RabbitMQ
      try {
        results.kafka = await kafkaService.send(
          processedMessage,
          options?.kafka || {}
        );
      } catch (kafkaError) {
        console.error("Lỗi khi gửi đến Kafka:", kafkaError);
        results.kafka = { error: kafkaError.message };
      }

      try {
        results.rabbitmq = await rabbitMQService.send(
          processedMessage,
          options?.rabbitmq || {}
        );
      } catch (rabbitmqError) {
        console.error("Lỗi khi gửi đến RabbitMQ:", rabbitmqError);
        results.rabbitmq = { error: rabbitmqError.message };
      }

      return res.json({
        success: true,
        target: "all",
        results,
      });
    } else if (target === "kafka") {
      // Chỉ gửi đến Kafka
      try {
        results.kafka = await kafkaService.send(
          processedMessage,
          options?.kafka || {}
        );
        return res.json({
          success: true,
          target: "kafka",
          result: results.kafka,
        });
      } catch (error) {
        return res.status(500).json({
          success: false,
          error: `Lỗi khi gửi đến Kafka: ${error.message}`,
          details: error,
        });
      }
    } else if (target === "rabbitmq") {
      // Chỉ gửi đến RabbitMQ
      try {
        results.rabbitmq = await rabbitMQService.send(
          processedMessage,
          options?.rabbitmq || {}
        );
        return res.json({
          success: true,
          target: "rabbitmq",
          result: results.rabbitmq,
        });
      } catch (error) {
        return res.status(500).json({
          success: false,
          error: `Lỗi khi gửi đến RabbitMQ: ${error.message}`,
          details: error,
        });
      }
    } else {
      return res.status(400).json({
        error: 'Target không hợp lệ. Sử dụng "kafka", "rabbitmq", hoặc "all"',
      });
    }
  } catch (error) {
    console.error("Lỗi khi gửi tin nhắn:", error);
    res
      .status(500)
      .json({ error: "Không thể gửi tin nhắn", details: error.message });
  }
});

/**
 * Gửi tin nhắn với các tính năng nâng cao
 * POST /send/advanced
 */
router.post("/send/advanced", async (req, res) => {
  try {
    const { message, options, feature } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    if (!feature) {
      return res.status(400).json({ error: "Feature is required" });
    }

    // Xử lý tin nhắn (chuỗi hoặc object)
    let processedMessage;
    if (typeof message === "string") {
      processedMessage = message;
    } else {
      // Nếu là object, thêm timestamp vào
      processedMessage = {
        ...message,
        timestamp: new Date().toISOString(),
      };
    }

    // Kết quả gửi tin nhắn
    let result;

    switch (feature) {
      case "kafka-transaction":
        // Gửi tin nhắn với Kafka transaction
        try {
          result = await kafkaService.sendWithTransaction(
            processedMessage,
            options?.kafka || {}
          );
          return res.json({
            success: true,
            feature: "kafka-transaction",
            result,
          });
        } catch (error) {
          return res.status(500).json({
            success: false,
            error: `Lỗi khi gửi tin nhắn với Kafka transaction: ${error.message}`,
            details: error,
          });
        }

      case "kafka-schema":
        // Gửi tin nhắn với Kafka schema
        if (!options?.schemaId) {
          return res.status(400).json({ error: "Schema ID is required" });
        }

        try {
          result = await kafkaService.sendWithSchema(
            processedMessage,
            options.schemaId,
            options?.kafka || {}
          );
          return res.json({
            success: true,
            feature: "kafka-schema",
            result,
          });
        } catch (error) {
          return res.status(500).json({
            success: false,
            error: `Lỗi khi gửi tin nhắn với Kafka schema: ${error.message}`,
            details: error,
          });
        }

      case "rabbitmq-priority":
        // Gửi tin nhắn với độ ưu tiên
        if (options?.priority === undefined) {
          return res.status(400).json({ error: "Priority is required" });
        }

        try {
          result = await rabbitMQService.sendWithPriority(
            processedMessage,
            options.priority,
            options?.rabbitmq || {}
          );
          return res.json({
            success: true,
            feature: "rabbitmq-priority",
            result,
          });
        } catch (error) {
          return res.status(500).json({
            success: false,
            error: `Lỗi khi gửi tin nhắn ưu tiên: ${error.message}`,
            details: error,
          });
        }

      case "rabbitmq-dlx":
        // Gửi tin nhắn đến Dead Letter Exchange
        if (!options?.reason) {
          return res.status(400).json({ error: "Reason is required" });
        }

        try {
          result = await rabbitMQService.sendToDeadLetterExchange(
            processedMessage,
            options.reason,
            options?.rabbitmq || {}
          );
          return res.json({
            success: true,
            feature: "rabbitmq-dlx",
            result,
          });
        } catch (error) {
          return res.status(500).json({
            success: false,
            error: `Lỗi khi gửi tin nhắn đến DLX: ${error.message}`,
            details: error,
          });
        }

      default:
        return res.status(400).json({
          error: `Tính năng không hỗ trợ: ${feature}`,
          supportedFeatures: [
            "kafka-transaction",
            "kafka-schema",
            "rabbitmq-priority",
            "rabbitmq-dlx",
          ],
        });
    }
  } catch (error) {
    console.error("Lỗi khi gửi tin nhắn nâng cao:", error);
    res
      .status(500)
      .json({ error: "Không thể gửi tin nhắn", details: error.message });
  }
});

module.exports = router;

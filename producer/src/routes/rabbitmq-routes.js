/**
 * RabbitMQ API Routes
 */
const express = require("express");
const router = express.Router();
const rabbitMQService = require("../services/rabbitmq/rabbitmq-service");

/**
 * Gửi tin nhắn đến RabbitMQ
 * POST /rabbitmq/send
 */
router.post("/send", async (req, res) => {
  try {
    const { message, options } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
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

    // Gửi tin nhắn đến RabbitMQ
    const result = await rabbitMQService.send(processedMessage, options || {});

    return res.json({
      success: true,
      target: "rabbitmq",
      result,
    });
  } catch (error) {
    console.error("Lỗi khi gửi tin nhắn đến RabbitMQ:", error);
    res.status(500).json({
      success: false,
      error: `Lỗi khi gửi đến RabbitMQ: ${error.message}`,
      details: error,
    });
  }
});

/**
 * Gửi tin nhắn với độ ưu tiên
 * POST /rabbitmq/priority
 */
router.post("/priority", async (req, res) => {
  try {
    const { message, priority, options } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    if (priority === undefined) {
      return res.status(400).json({ error: "Priority is required" });
    }

    // Xử lý tin nhắn
    let processedMessage;
    if (typeof message === "string") {
      processedMessage = message;
    } else {
      processedMessage = {
        ...message,
        timestamp: new Date().toISOString(),
      };
    }

    // Gửi tin nhắn với độ ưu tiên
    const result = await rabbitMQService.sendWithPriority(
      processedMessage,
      priority,
      options || {}
    );

    return res.json({
      success: true,
      feature: "rabbitmq-priority",
      result,
    });
  } catch (error) {
    console.error("Lỗi khi gửi tin nhắn ưu tiên:", error);
    res.status(500).json({
      success: false,
      error: `Lỗi khi gửi tin nhắn ưu tiên: ${error.message}`,
      details: error,
    });
  }
});

/**
 * Gửi tin nhắn đến Dead Letter Exchange
 * POST /rabbitmq/dlx
 */
router.post("/dlx", async (req, res) => {
  try {
    const { message, reason, options } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    if (!reason) {
      return res.status(400).json({ error: "Reason is required" });
    }

    // Xử lý tin nhắn
    let processedMessage;
    if (typeof message === "string") {
      processedMessage = message;
    } else {
      processedMessage = {
        ...message,
        timestamp: new Date().toISOString(),
      };
    }

    // Gửi tin nhắn đến Dead Letter Exchange
    const result = await rabbitMQService.sendToDeadLetterExchange(
      processedMessage,
      reason,
      options || {}
    );

    return res.json({
      success: true,
      feature: "rabbitmq-dlx",
      result,
    });
  } catch (error) {
    console.error("Lỗi khi gửi tin nhắn đến DLX:", error);
    res.status(500).json({
      success: false,
      error: `Lỗi khi gửi tin nhắn đến DLX: ${error.message}`,
      details: error,
    });
  }
});

/**
 * Thực hiện các thao tác quản trị RabbitMQ
 * POST /rabbitmq/admin
 */
router.post("/admin", async (req, res) => {
  try {
    const { action, options } = req.body;

    if (!action) {
      return res.status(400).json({ error: "Action is required" });
    }

    // Thực hiện thao tác quản trị
    const result = await rabbitMQService.adminAction(action, options || {});

    return res.json({ success: true, result: result.result });
  } catch (error) {
    console.error("RabbitMQ admin error:", error);
    res.status(500).json({
      error: "Failed to perform RabbitMQ admin action",
      details: error.message,
    });
  }
});

module.exports = router;

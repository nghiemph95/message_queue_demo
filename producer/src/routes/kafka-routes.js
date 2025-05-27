/**
 * Kafka API Routes
 */
const express = require("express");
const router = express.Router();
const kafkaService = require("../services/kafka/kafka-service");
const schemaRegistry = require("../services/kafka/schema-registry");

/**
 * Gửi tin nhắn đến Kafka
 * POST /kafka/send
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
    } else if (Array.isArray(message)) {
      processedMessage = message;
    } else {
      // Nếu là object, thêm timestamp vào
      processedMessage = {
        ...message,
        timestamp: new Date().toISOString(),
      };
    }

    // Gửi tin nhắn đến Kafka
    const result = await kafkaService.send(processedMessage, options || {});

    return res.json({
      success: true,
      target: "kafka",
      result,
    });
  } catch (error) {
    console.error("Lỗi khi gửi tin nhắn đến Kafka:", error);
    res.status(500).json({
      success: false,
      error: `Lỗi khi gửi đến Kafka: ${error.message}`,
      details: error,
    });
  }
});

/**
 * Gửi tin nhắn với transaction
 * POST /kafka/transaction
 */
router.post("/transaction", async (req, res) => {
  try {
    const { message, options } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Xử lý tin nhắn
    let processedMessage;
    if (typeof message === "string") {
      processedMessage = message;
    } else if (Array.isArray(message)) {
      processedMessage = message;
    } else {
      processedMessage = {
        ...message,
        timestamp: new Date().toISOString(),
      };
    }

    // Gửi tin nhắn với transaction
    const result = await kafkaService.sendWithTransaction(
      processedMessage,
      options || {}
    );

    return res.json({
      success: true,
      feature: "kafka-transaction",
      result,
    });
  } catch (error) {
    console.error("Lỗi khi gửi tin nhắn với Kafka transaction:", error);
    res.status(500).json({
      success: false,
      error: `Lỗi khi gửi tin nhắn với Kafka transaction: ${error.message}`,
      details: error,
    });
  }
});

/**
 * Gửi tin nhắn với schema
 * POST /kafka/schema
 */
router.post("/schema", async (req, res) => {
  try {
    const { message, schemaId, options } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    if (!schemaId) {
      return res.status(400).json({ error: "Schema ID is required" });
    }

    // Gửi tin nhắn với schema
    const result = await kafkaService.sendWithSchema(
      message,
      schemaId,
      options || {}
    );

    return res.json({
      success: true,
      feature: "kafka-schema",
      result,
    });
  } catch (error) {
    console.error("Lỗi khi gửi tin nhắn với Kafka schema:", error);
    res.status(500).json({
      success: false,
      error: `Lỗi khi gửi tin nhắn với Kafka schema: ${error.message}`,
      details: error,
    });
  }
});

/**
 * Thực hiện các thao tác quản trị Kafka
 * POST /kafka/admin
 */
router.post("/admin", async (req, res) => {
  try {
    const { action, options } = req.body;

    if (!action) {
      return res.status(400).json({ error: "Action is required" });
    }

    // Tạo admin client
    const admin = kafkaService.createAdminClient();
    await admin.connect();

    let result;

    switch (action) {
      case "create-topic":
        // Tạo topic mới
        if (!options?.topic) {
          await admin.disconnect();
          return res.status(400).json({ error: "Topic name is required" });
        }

        // Kiểm tra nếu là compacted topic
        if (options.compacted) {
          // Đối với compacted topic, cleanup.policy phải là 'compact'
          if (!options.configs) options.configs = {};
          options.configs["cleanup.policy"] = "compact";
          console.log("Tạo compacted topic với cleanup.policy=compact");
        }

        result = await admin.createTopics({
          topics: [
            {
              topic: options.topic,
              numPartitions: options.numPartitions || 1,
              replicationFactor: options.replicationFactor || 1,
              configEntries: options.configEntries || [],
              ...options.configs,
            },
          ],
        });
        break;

      case "list-topics":
        // Liệt kê tất cả các topic
        result = await admin.listTopics();
        break;

      case "topic-metadata":
        // Lấy metadata của topic
        if (!options?.topics) {
          await admin.disconnect();
          return res.status(400).json({ error: "Topics are required" });
        }

        result = await admin.fetchTopicMetadata({
          topics: Array.isArray(options.topics)
            ? options.topics
            : [options.topics],
        });
        break;

      case "register-schema":
        // Đăng ký schema mới
        if (!options?.schema || !options?.subject) {
          await admin.disconnect();
          return res
            .status(400)
            .json({ error: "Schema and subject are required" });
        }

        try {
          const registrationResult = await schemaRegistry.register(
            options.schema,
            options.subject
          );
          result = registrationResult;
        } catch (error) {
          await admin.disconnect();
          return res.status(500).json({
            error: "Failed to register schema",
            details: error.message,
          });
        }
        break;

      case "create-compacted-topic":
        // Tạo compacted topic
        if (!options?.topic) {
          await admin.disconnect();
          return res.status(400).json({ error: "Topic name is required" });
        }

        await admin.createTopics({
          topics: [
            {
              topic: options.topic,
              numPartitions: options.numPartitions || 1,
              replicationFactor: options.replicationFactor || 1,
              configEntries: [
                { name: "cleanup.policy", value: "compact" },
                {
                  name: "min.compaction.lag.ms",
                  value: options.minCompactionLag || "0",
                },
                {
                  name: "max.compaction.lag.ms",
                  value: options.maxCompactionLag || "86400000",
                }, // 1 day default
                { name: "segment.ms", value: options.segmentMs || "604800000" }, // 1 week default
              ],
            },
          ],
        });

        result = { topic: options.topic, compacted: true };
        break;

      default:
        await admin.disconnect();
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }

    await admin.disconnect();
    return res.json({ success: true, result });
  } catch (error) {
    console.error("Kafka admin error:", error);
    res.status(500).json({
      error: "Failed to perform Kafka admin action",
      details: error.message,
    });
  }
});

module.exports = router;

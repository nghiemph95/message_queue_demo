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
  brokers: [process.env.KAFKA_BROKER || "kafka:29092"],
});
const producer = kafka.producer();

// Connect to Kafka on startup with exponential backoff retry
async function connectKafka(retryCount = 0) {
  try {
    await producer.connect();
    console.log("Kết nối thành công đến Kafka");
    // Reset connection state
    global.kafkaConnected = true;
    return true;
  } catch (error) {
    // Chi tiết hóa các loại lỗi
    if (error.name === "KafkaJSConnectionError") {
      console.error("Không thể kết nối đến Kafka broker:", error.message);
    } else if (error.name === "KafkaJSProtocolError") {
      console.error("Lỗi giao thức Kafka:", error.message);
    } else if (error.name === "KafkaJSBrokerNotFound") {
      console.error("Không tìm thấy Kafka broker:", error.message);
    } else {
      console.error("Lỗi không xác định khi kết nối Kafka:", error);
    }

    // Exponential backoff với giới hạn thử lại
    const maxRetries = 10;
    if (retryCount < maxRetries) {
      // Tính toán thời gian chờ với exponential backoff
      // Formula: baseDelay * (2^retryCount) với jitter ngẫu nhiên
      const baseDelay = 1000; // 1 giây
      const exponentialDelay = baseDelay * Math.pow(2, retryCount);
      const jitter = Math.random() * 1000; // Thêm độ ngẫu nhiên để tránh thundering herd
      const delay = Math.min(exponentialDelay + jitter, 30000); // Giới hạn tối đa 30 giây

      console.log(
        `Thử kết nối lại sau ${Math.round(delay / 1000)} giây (lần thử ${
          retryCount + 1
        }/${maxRetries})...`
      );

      // Đặt trạng thái kết nối
      global.kafkaConnected = false;

      // Lên lịch thử lại
      setTimeout(() => connectKafka(retryCount + 1), delay);
      return false;
    } else {
      console.error(
        `Đã thử kết nối lại ${maxRetries} lần nhưng không thành công. Vui lòng kiểm tra cấu hình Kafka.`
      );
      global.kafkaConnected = false;
      return false;
    }
  }
}

connectKafka();

// Send message to Kafka with advanced options
async function sendToKafka(message, options = {}) {
  // Kiểm tra trạng thái kết nối
  if (!global.kafkaConnected) {
    console.warn("Kafka chưa được kết nối, đang thử kết nối lại...");
    const connected = await connectKafka();
    if (!connected) {
      throw new Error("Không thể kết nối đến Kafka để gửi tin nhắn");
    }
  }

  try {
    // Xử lý tin nhắn đơn hoặc batch
    let messages = [];

    if (Array.isArray(message)) {
      // Batch mode - gửi nhiều tin nhắn cùng lúc
      console.log(`Đang gửi batch ${message.length} tin nhắn đến Kafka`);
      messages = message.map((msg) => ({
        // Thêm key để đảm bảo các tin nhắn cùng key đi vào cùng partition
        key: options.key || msg.key || String(Math.floor(Math.random() * 10)),
        value: typeof msg === "object" ? JSON.stringify(msg) : String(msg),
        // Headers chứa metadata về tin nhắn
        headers: options.headers || {
          source: "demo-producer",
          timestamp: Date.now().toString(),
        },
        // Timestamp tùy chỉnh (nếu có)
        timestamp: options.timestamp || Date.now().toString(),
      }));
    } else {
      // Single message mode
      const msgValue =
        typeof message === "object" ? JSON.stringify(message) : String(message);
      messages = [
        {
          key: options.key || String(Math.floor(Math.random() * 10)),
          value: msgValue,
          headers: options.headers || {
            source: "demo-producer",
            timestamp: Date.now().toString(),
          },
          timestamp: options.timestamp || Date.now().toString(),
        },
      ];
    }

    // Cấu hình nâng cao cho việc gửi tin nhắn
    const sendConfig = {
      // Topic để gửi tin nhắn đến
      topic: options.topic || process.env.KAFKA_TOPIC || "test-topic",
      messages: messages,
      // Các tùy chỉnh khác
      acks: options.acks || -1, // -1 = all: đảm bảo tất cả replicas đều nhận được tin nhắn
      timeout: options.timeout || 30000, // Thời gian chờ tối đa cho mỗi request (ms)
      compression: options.compression || 1, // 1 = GZIP: nén dữ liệu để giảm băng thông
    };

    // Gửi tin nhắn và đợi kết quả
    const result = await producer.send(sendConfig);

    // Hiển thị thông tin về kết quả gửi
    if (Array.isArray(message)) {
      console.log(`Đã gửi thành công ${messages.length} tin nhắn đến Kafka`);
    } else {
      console.log(
        `Đã gửi thành công tin nhắn đến Kafka: ${
          typeof message === "object" ? JSON.stringify(message) : message
        }`
      );
    }

    // Trả về kết quả chi tiết
    return {
      success: true,
      result: result,
      messageCount: messages.length,
    };
  } catch (error) {
    // Xử lý lỗi chi tiết
    console.error("Lỗi khi gửi tin nhắn đến Kafka:", error);

    if (error.name === "KafkaJSConnectionError") {
      console.error("Lỗi kết nối Kafka:", error.message);
      // Đánh dấu trạng thái kết nối để thử kết nối lại lần sau
      global.kafkaConnected = false;
    } else if (error.name === "KafkaJSNonRetriableError") {
      console.error("Lỗi không thể thử lại:", error.message);
    } else if (error.name === "KafkaJSNumberOfRetriesExceeded") {
      console.error("Vượt quá số lần thử lại:", error.message);
    } else {
      console.error("Lỗi không xác định:", error);
    }

    // Trả về lỗi để xử lý ở nơi gọi hàm
    throw error;
  }
}

// RabbitMQ connection pool management
const rabbitPool = {
  connection: null,
  channel: null,
  connecting: false,
  connectionRetries: 0,
  maxRetries: 10,
  lastError: null,

  // Khởi tạo kết nối đến RabbitMQ với retry
  async connect(retryCount = 0) {
    if (this.connecting) {
      console.log("RabbitMQ đang trong quá trình kết nối, đang đợi...");
      // Đợi kết nối hoàn tất
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return this.connection && this.channel;
    }

    try {
      this.connecting = true;

      // Đóng kết nối cũ nếu có
      if (this.connection) {
        try {
          if (this.channel) await this.channel.close();
          await this.connection.close();
        } catch (closeErr) {
          console.warn("Lỗi khi đóng kết nối RabbitMQ cũ:", closeErr.message);
        }
      }

      // Tạo kết nối mới
      this.connection = await amqp.connect(
        process.env.RABBITMQ_URL || "amqp://guest:guest@rabbitmq"
      );

      // Xử lý sự kiện đóng kết nối bất ngờ
      this.connection.on("error", (err) => {
        console.error("Lỗi kết nối RabbitMQ:", err.message);
        this.lastError = err;
        this.connection = null;
        this.channel = null;
        this.connecting = false;
      });

      this.connection.on("close", () => {
        console.log("Kết nối RabbitMQ đã đóng");
        this.connection = null;
        this.channel = null;
        this.connecting = false;
      });

      // Tạo channel
      this.channel = await this.connection.createChannel();

      // Xử lý sự kiện đóng channel
      this.channel.on("error", (err) => {
        console.error("Lỗi channel RabbitMQ:", err.message);
        this.channel = null;
      });

      this.channel.on("close", () => {
        console.log("Channel RabbitMQ đã đóng");
        this.channel = null;
      });

      console.log("Kết nối thành công đến RabbitMQ");
      this.connectionRetries = 0;
      this.connecting = false;
      return true;
    } catch (error) {
      this.lastError = error;
      this.connecting = false;

      // Xử lý retry với exponential backoff
      if (retryCount < this.maxRetries) {
        const baseDelay = 1000;
        const exponentialDelay = baseDelay * Math.pow(2, retryCount);
        const jitter = Math.random() * 1000;
        const delay = Math.min(exponentialDelay + jitter, 30000);

        console.error(
          `Lỗi kết nối RabbitMQ: ${error.message}. Thử lại sau ${Math.round(
            delay / 1000
          )} giây (lần ${retryCount + 1}/${this.maxRetries})`
        );

        this.connectionRetries = retryCount + 1;
        setTimeout(() => this.connect(retryCount + 1), delay);
        return false;
      } else {
        console.error(
          `Đã thử kết nối lại ${this.maxRetries} lần nhưng không thành công. Lỗi cuối cùng: ${error.message}`
        );
        return false;
      }
    }
  },

  // Đảm bảo có kết nối khả dụng
  async ensureConnection() {
    if (this.channel && this.connection) {
      return true;
    }
    return await this.connect();
  },

  // Đóng kết nối
  async close() {
    if (this.channel) {
      try {
        await this.channel.close();
      } catch (err) {
        console.warn("Lỗi khi đóng channel:", err.message);
      }
      this.channel = null;
    }

    if (this.connection) {
      try {
        await this.connection.close();
      } catch (err) {
        console.warn("Lỗi khi đóng connection:", err.message);
      }
      this.connection = null;
    }

    console.log("RabbitMQ connection pool đã đóng");
  },
};

// Khởi tạo kết nối RabbitMQ khi khởi động
rabbitPool.connect();

// Send message to RabbitMQ with advanced options
async function sendToRabbitMQ(message, options = {}) {
  try {
    // Đảm bảo có kết nối
    const connected = await rabbitPool.ensureConnection();
    if (!connected) {
      throw new Error("Không thể kết nối đến RabbitMQ để gửi tin nhắn");
    }

    const channel = rabbitPool.channel;

    // Xác định exchange type và tên
    const exchangeType = options.exchangeType || "direct";
    const exchangeName = options.exchange || "";

    // Nếu có exchange, khai báo exchange
    if (exchangeName) {
      await channel.assertExchange(exchangeName, exchangeType, {
        durable:
          options.durableExchange !== undefined
            ? options.durableExchange
            : true,
      });
    }

    // Xác định tên hàng đợi
    const queue = options.queue || process.env.RABBITMQ_QUEUE || "test-queue";

    // Khai báo hàng đợi với các tùy chỉnh
    const queueOptions = {
      // durable: true - hàng đợi sẽ được lưu trữ trên đĩa, tồn tại sau khi restart
      durable: options.durable !== undefined ? options.durable : true,
      // exclusive: true - chỉ cho phép kết nối hiện tại truy cập hàng đợi
      exclusive: options.exclusive || false,
      // autoDelete: true - tự động xóa hàng đợi khi không còn kết nối nào
      autoDelete: options.autoDelete || false,
      // arguments - các đối số bổ sung cho hàng đợi
      arguments: options.arguments || {},
    };

    // Nếu có deadLetterExchange, thêm vào arguments
    if (options.deadLetterExchange) {
      queueOptions.arguments = queueOptions.arguments || {};
      queueOptions.arguments["x-dead-letter-exchange"] =
        options.deadLetterExchange;

      if (options.deadLetterRoutingKey) {
        queueOptions.arguments["x-dead-letter-routing-key"] =
          options.deadLetterRoutingKey;
      }
    }

    // Nếu có messageTtl (time-to-live), thêm vào arguments
    if (options.messageTtl) {
      queueOptions.arguments = queueOptions.arguments || {};
      queueOptions.arguments["x-message-ttl"] = options.messageTtl;
    }

    // Khai báo hàng đợi
    const queueResult = await channel.assertQueue(queue, queueOptions);

    // Nếu có exchange và routingKey, bind hàng đợi với exchange
    if (exchangeName) {
      const routingKey = options.routingKey || queue;
      await channel.bindQueue(queue, exchangeName, routingKey);
    }

    // Chuẩn bị tin nhắn
    let content;
    if (typeof message === "object") {
      content = Buffer.from(JSON.stringify(message));
    } else {
      content = Buffer.from(String(message));
    }

    // Các tùy chỉnh cho tin nhắn
    const messageOptions = {
      // persistent: true - tin nhắn sẽ được lưu trữ trên đĩa
      persistent: options.persistent !== undefined ? options.persistent : true,
      // expiration: thời gian hết hạn của tin nhắn (ms)
      expiration: options.expiration,
      // contentType: loại nội dung của tin nhắn
      contentType:
        options.contentType ||
        (typeof message === "object" ? "application/json" : "text/plain"),
      // contentEncoding: mã hóa nội dung
      contentEncoding: options.contentEncoding,
      // headers: các header tùy chỉnh
      headers: options.headers || {
        source: "demo-producer",
        timestamp: Date.now().toString(),
      },
      // priority: độ ưu tiên của tin nhắn (0-9)
      priority: options.priority,
      // correlationId: ID tương quan (dùng cho mô hình RPC)
      correlationId: options.correlationId,
      // replyTo: hàng đợi để trả lời (dùng cho mô hình RPC)
      replyTo: options.replyTo,
      // messageId: ID duy nhất cho tin nhắn
      messageId:
        options.messageId ||
        `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    };

    // Gửi tin nhắn
    if (exchangeName) {
      // Gửi qua exchange
      const routingKey = options.routingKey || queue;
      const sent = channel.publish(
        exchangeName,
        routingKey,
        content,
        messageOptions
      );
      if (sent) {
        console.log(
          `Đã gửi tin nhắn đến RabbitMQ exchange '${exchangeName}' với routing key '${routingKey}'`
        );
      } else {
        console.warn("Tin nhắn đã được đưa vào hàng đợi nội bộ do kênh bị đầy");
      }
    } else {
      // Gửi trực tiếp đến hàng đợi
      const sent = channel.sendToQueue(queue, content, messageOptions);
      if (sent) {
        console.log(`Đã gửi tin nhắn đến RabbitMQ queue '${queue}'`);
      } else {
        console.warn("Tin nhắn đã được đưa vào hàng đợi nội bộ do kênh bị đầy");
      }
    }

    // Nếu yêu cầu xác nhận, đợi xác nhận từ server
    if (options.confirm) {
      await channel.waitForConfirms();
      console.log("Tin nhắn đã được xác nhận bởi RabbitMQ server");
    }

    return {
      success: true,
      queue: queueResult.queue,
      messageCount: queueResult.messageCount,
      consumerCount: queueResult.consumerCount,
    };
  } catch (error) {
    console.error("Lỗi khi gửi tin nhắn đến RabbitMQ:", error);
    throw error;
  }
}

// API endpoints
app.post("/send", async (req, res) => {
  try {
    const { message, target, options } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Xử lý tin nhắn (chuỗi hoặc object)
    let processedMessage;
    if (typeof message === "string") {
      const timestamp = new Date().toISOString();
      processedMessage = `${message} at ${timestamp}`;
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
        results.kafka = await sendToKafka(
          processedMessage,
          options?.kafka || {}
        );
      } catch (kafkaError) {
        console.error("Lỗi khi gửi đến Kafka:", kafkaError);
        results.kafka = { success: false, error: kafkaError.message };
      }

      try {
        results.rabbitmq = await sendToRabbitMQ(
          processedMessage,
          options?.rabbitmq || {}
        );
      } catch (rmqError) {
        console.error("Lỗi khi gửi đến RabbitMQ:", rmqError);
        results.rabbitmq = { success: false, error: rmqError.message };
      }

      return res.json({
        success: results.kafka?.success || results.rabbitmq?.success,
        message: "Kết quả gửi tin nhắn đến cả Kafka và RabbitMQ",
        results,
      });
    } else if (target === "kafka") {
      // Chỉ gửi đến Kafka
      try {
        results.kafka = await sendToKafka(
          processedMessage,
          options?.kafka || {}
        );
        return res.json({
          success: true,
          message: "Tin nhắn đã được gửi đến Kafka",
          results,
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
        results.rabbitmq = await sendToRabbitMQ(
          processedMessage,
          options?.rabbitmq || {}
        );
        return res.json({
          success: true,
          message: "Tin nhắn đã được gửi đến RabbitMQ",
          results,
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

// API endpoint cho các tính năng nâng cao của Kafka
app.post("/kafka/admin", async (req, res) => {
  try {
    const { action, options } = req.body;

    if (!action) {
      return res.status(400).json({ error: "Action is required" });
    }

    // Tạo admin client
    const admin = kafka.admin();
    await admin.connect();

    let result;

    switch (action) {
      case "create-topic":
        // Tạo topic mới
        if (!options?.topic) {
          await admin.disconnect();
          return res.status(400).json({ error: "Topic name is required" });
        }

        result = await admin.createTopics({
          topics: [
            {
              topic: options.topic,
              numPartitions: options.numPartitions || 1,
              replicationFactor: options.replicationFactor || 1,
              configEntries: options.configEntries || [],
            },
          ],
        });

        break;

      case "list-topics":
        // Liệt kê tất cả topics
        result = await admin.listTopics();
        break;

      case "topic-metadata":
        // Lấy metadata của topic
        if (!options?.topics) {
          await admin.disconnect();
          return res.status(400).json({ error: "Topics array is required" });
        }

        result = await admin.fetchTopicMetadata({
          topics: Array.isArray(options.topics)
            ? options.topics
            : [options.topics],
        });
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

// API endpoint cho các tính năng nâng cao của RabbitMQ
app.post("/rabbitmq/admin", async (req, res) => {
  try {
    const { action, options } = req.body;

    if (!action) {
      return res.status(400).json({ error: "Action is required" });
    }

    // Đảm bảo có kết nối
    const connected = await rabbitPool.ensureConnection();
    if (!connected) {
      return res.status(500).json({ error: "Failed to connect to RabbitMQ" });
    }

    const channel = rabbitPool.channel;
    let result;

    switch (action) {
      case "create-exchange":
        // Tạo exchange mới
        if (!options?.name || !options?.type) {
          return res
            .status(400)
            .json({ error: "Exchange name and type are required" });
        }

        await channel.assertExchange(options.name, options.type, {
          durable: options.durable !== undefined ? options.durable : true,
          autoDelete: options.autoDelete || false,
          internal: options.internal || false,
          arguments: options.arguments || {},
        });

        result = { exchangeName: options.name, type: options.type };
        break;

      case "create-queue":
        // Tạo queue mới
        if (!options?.name) {
          return res.status(400).json({ error: "Queue name is required" });
        }

        result = await channel.assertQueue(options.name, {
          durable: options.durable !== undefined ? options.durable : true,
          exclusive: options.exclusive || false,
          autoDelete: options.autoDelete || false,
          arguments: options.arguments || {},
        });
        break;

      case "bind-queue":
        // Bind queue với exchange
        if (!options?.queue || !options?.exchange) {
          return res
            .status(400)
            .json({ error: "Queue and exchange names are required" });
        }

        await channel.bindQueue(
          options.queue,
          options.exchange,
          options.routingKey || ""
        );

        result = {
          queue: options.queue,
          exchange: options.exchange,
          routingKey: options.routingKey || "",
        };
        break;

      case "delete-queue":
        // Xóa queue
        if (!options?.name) {
          return res.status(400).json({ error: "Queue name is required" });
        }

        result = await channel.deleteQueue(options.name);
        break;

      case "delete-exchange":
        // Xóa exchange
        if (!options?.name) {
          return res.status(400).json({ error: "Exchange name is required" });
        }

        await channel.deleteExchange(options.name);
        result = { exchangeName: options.name, deleted: true };
        break;

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }

    return res.json({ success: true, result });
  } catch (error) {
    console.error("RabbitMQ admin error:", error);
    res.status(500).json({
      error: "Failed to perform RabbitMQ admin action",
      details: error.message,
    });
  }
});

// API for health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Producer API running on port ${PORT}`);
  console.log(
    'Send messages using POST /send with JSON body: { "message": "Your message", "target": "kafka|rabbitmq|all" }'
  );
});

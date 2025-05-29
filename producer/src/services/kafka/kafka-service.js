/**
 * Kafka Service - Xử lý kết nối và gửi tin nhắn đến Kafka
 */
const { Kafka } = require("kafkajs");
const config = require("../../config");
const schemaRegistry = require("./schema-registry");

class KafkaService {
  constructor() {
    this.kafka = new Kafka({
      clientId: config.kafka.clientId,
      brokers: config.kafka.brokers,
    });

    // Tạo producer thông thường
    this.producer = this.kafka.producer();

    // Tạo transactional producer
    this.transactionalProducer = this.kafka.producer({
      transactionalId: config.kafka.transactionalId,
      maxInFlightRequests: 1,
      idempotent: true, // Đảm bảo exactly-once semantics
    });

    // Trạng thái kết nối
    this.connected = false;
    this.transactionalConnected = false;
  }

  /**
   * Kết nối đến Kafka với exponential backoff retry
   * @param {Number} retryCount - Số lần thử lại
   * @returns {Boolean} Trạng thái kết nối
   */
  async connect(retryCount = 0) {
    try {
      await this.producer.connect();
      console.log("Kết nối thành công đến Kafka");
      this.connected = true;
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
        this.connected = false;

        // Lên lịch thử lại
        setTimeout(() => this.connect(retryCount + 1), delay);
        return false;
      } else {
        console.error(
          `Đã thử kết nối lại ${maxRetries} lần nhưng không thành công. Vui lòng kiểm tra cấu hình Kafka.`
        );
        this.connected = false;
        return false;
      }
    }
  }

  /**
   * Kết nối transactional producer
   * @returns {Boolean} Trạng thái kết nối
   */
  async connectTransactional() {
    try {
      await this.transactionalProducer.connect();
      console.log("Kết nối thành công đến Kafka với transactional producer");
      this.transactionalConnected = true;
      return true;
    } catch (error) {
      console.error("Lỗi khi kết nối transactional producer:", error);
      this.transactionalConnected = false;
      return false;
    }
  }

  /**
   * Gửi tin nhắn đến Kafka
   * @param {String|Object|Array} message - Tin nhắn cần gửi
   * @param {Object} options - Tùy chọn gửi tin nhắn
   * @returns {Object} Kết quả gửi tin nhắn
   */
  async send(message, options = {}) {
    // Kiểm tra trạng thái kết nối
    if (!this.connected) {
      console.warn("Kafka chưa được kết nối, đang thử kết nối lại...");
      const connected = await this.connect();
      if (!connected) {
        throw new Error("Không thể kết nối đến Kafka để gửi tin nhắn");
      }
    }

    try {
      // Xử lý tin nhắn đơn hoặc batch
      let messages = [];
      const topic = options.topic || config.kafka.defaultTopic;

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
          typeof message === "object"
            ? JSON.stringify(message)
            : String(message);
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

      // Gửi tin nhắn đến Kafka
      const result = await this.producer.send({
        topic,
        messages,
        acks: options.acks || -1, // -1 = all brokers must acknowledge
        timeout: options.timeout || 30000,
        compression: options.compression || 0, // 0 = no compression
      });

      return {
        success: true,
        topic,
        messageCount: messages.length,
        result,
      };
    } catch (error) {
      // Xử lý các loại lỗi cụ thể
      if (error.name === "KafkaJSConnectionError") {
        console.error("Lỗi kết nối khi gửi tin nhắn:", error.message);
        // Đánh dấu trạng thái kết nối để thử kết nối lại lần sau
        this.connected = false;
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

  /**
   * Gửi tin nhắn với transactional API
   * @param {String|Object|Array} messages - Tin nhắn cần gửi
   * @param {Object} options - Tùy chọn gửi tin nhắn
   * @returns {Object} Kết quả gửi tin nhắn
   */
  async sendWithTransaction(messages, options = {}) {
    try {
      // Đảm bảo producer đã kết nối
      if (!this.transactionalConnected) {
        await this.connectTransactional();
      }

      // Bắt đầu transaction
      await this.transactionalProducer.transaction(async (transaction) => {
        console.log("Bắt đầu Kafka transaction");

        // Chuẩn bị tin nhắn
        const topic = options.topic || config.kafka.defaultTopic;
        const formattedMessages = Array.isArray(messages)
          ? messages
          : [messages];

        // Gửi tin nhắn trong transaction
        const result = await transaction.send({
          topic,
          messages: formattedMessages.map((msg) => ({
            key: options.key || String(Math.floor(Math.random() * 10)),
            value: typeof msg === "object" ? JSON.stringify(msg) : String(msg),
            headers: options.headers || {
              source: "transactional-producer",
              timestamp: Date.now().toString(),
            },
          })),
        });

        // Mô phỏng xử lý logic nghiệp vụ
        if (options.simulateError) {
          console.log("Mô phỏng lỗi, abort transaction");
          await transaction.abort();
          throw new Error("Transaction aborted due to simulated error");
        }

        console.log("Commit Kafka transaction");
        // Transaction tự động commit khi callback hoàn thành
        return result;
      });

      return { success: true, transactional: true };
    } catch (error) {
      console.error("Lỗi trong Kafka transaction:", error);
      throw error;
    }
  }

  /**
   * Gửi tin nhắn với schema
   * @param {Object} message - Tin nhắn cần gửi
   * @param {Number} schemaId - ID của schema
   * @param {Object} options - Tùy chọn gửi tin nhắn
   * @returns {Object} Kết quả gửi tin nhắn
   */
  async sendWithSchema(message, schemaId, options = {}) {
    try {
      // Lấy schema từ registry
      const schema = await schemaRegistry.getById(schemaId);

      // Encode tin nhắn với schema
      const encodedMessage = schemaRegistry.encode(message, schemaId);

      // Gửi tin nhắn đã encode
      const topic = options.topic || config.kafka.defaultTopic;

      const result = await this.producer.send({
        topic,
        messages: [
          {
            key: options.key || String(Math.floor(Math.random() * 10)),
            value: encodedMessage,
            headers: {
              ...options.headers,
              "schema-id": String(schemaId),
            },
          },
        ],
      });

      return { success: true, schemaId };
    } catch (error) {
      console.error("Lỗi khi gửi tin nhắn với schema:", error);
      throw error;
    }
  }

  /**
   * Tạo Kafka Admin client
   * @returns {Object} Kafka Admin client
   */
  createAdminClient() {
    return this.kafka.admin();
  }

  /**
   * Đóng kết nối đến Kafka
   */
  async disconnect() {
    try {
      await this.producer.disconnect();
      if (this.transactionalConnected) {
        await this.transactionalProducer.disconnect();
      }
      console.log("Đã đóng kết nối đến Kafka");
      this.connected = false;
      this.transactionalConnected = false;
    } catch (error) {
      console.error("Lỗi khi đóng kết nối Kafka:", error);
    }
  }
}

module.exports = new KafkaService();

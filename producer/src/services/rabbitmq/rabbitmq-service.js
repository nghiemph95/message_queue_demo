/**
 * RabbitMQ Service - Xử lý kết nối và gửi tin nhắn đến RabbitMQ
 */
const amqp = require("amqplib");
const config = require("../../config");

class RabbitMQService {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.connecting = false;
    this.connectionRetries = 0;
    this.maxRetries = config.rabbitmq.maxRetries;
    this.lastError = null;
  }

  /**
   * Khởi tạo kết nối đến RabbitMQ với retry
   * @param {Number} retryCount - Số lần thử lại
   * @returns {Boolean} Trạng thái kết nối
   */
  async connect(retryCount = 0) {
    if (this.connecting) {
      console.log("RabbitMQ đang trong quá trình kết nối, đang đợi...");
      // Đợi kết nối hoàn tất
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return this.connection && this.channel;
    }

    try {
      this.connecting = true;

      // Kết nối đến RabbitMQ server
      this.connection = await amqp.connect(config.rabbitmq.url);
      console.log("Kết nối thành công đến RabbitMQ");

      // Xử lý sự kiện đóng kết nối
      this.connection.on("close", (err) => {
        console.warn("Kết nối RabbitMQ đã đóng:", err ? err.message : "");
        this.connection = null;
        this.channel = null;

        // Thử kết nối lại sau một khoảng thời gian
        setTimeout(() => this.connect(), 5000);
      });

      // Xử lý sự kiện lỗi
      this.connection.on("error", (err) => {
        console.error("Lỗi kết nối RabbitMQ:", err.message);
        this.lastError = err;

        // Đóng kết nối nếu có lỗi nghiêm trọng
        if (err.message.includes("Connection closed")) {
          this.connection = null;
          this.channel = null;
        }
      });

      // Tạo channel
      this.channel = await this.connection.createChannel();
      console.log("Đã tạo channel RabbitMQ");

      // Reset trạng thái
      this.connecting = false;
      this.connectionRetries = 0;
      return true;
    } catch (error) {
      console.error("Lỗi khi kết nối đến RabbitMQ:", error.message);
      this.lastError = error;
      this.connecting = false;

      // Thử kết nối lại với exponential backoff
      if (retryCount < this.maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
        console.log(
          `Thử kết nối lại sau ${delay / 1000} giây (lần thử ${
            retryCount + 1
          }/${this.maxRetries})...`
        );
        this.connectionRetries = retryCount + 1;
        setTimeout(() => this.connect(retryCount + 1), delay);
        return false;
      } else {
        console.error(
          `Đã thử kết nối lại ${this.maxRetries} lần nhưng không thành công. Vui lòng kiểm tra cấu hình RabbitMQ.`
        );
        return false;
      }
    }
  }

  /**
   * Đảm bảo có kết nối khả dụng
   * @returns {Boolean} Trạng thái kết nối
   */
  async ensureConnection() {
    if (this.channel && this.connection) {
      return true;
    }
    return await this.connect();
  }

  /**
   * Đóng kết nối
   */
  async close() {
    try {
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }
      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }
      console.log("RabbitMQ connection pool đã đóng");
    } catch (error) {
      console.error("Lỗi khi đóng kết nối RabbitMQ:", error.message);
    }
  }

  /**
   * Gửi tin nhắn đến RabbitMQ
   * @param {String|Object} message - Tin nhắn cần gửi
   * @param {Object} options - Tùy chọn gửi tin nhắn
   * @returns {Object} Kết quả gửi tin nhắn
   */
  async send(message, options = {}) {
    try {
      // Đảm bảo có kết nối
      const connected = await this.ensureConnection();
      if (!connected) {
        throw new Error("Không thể kết nối đến RabbitMQ để gửi tin nhắn");
      }

      const channel = this.channel;

      // Xác định exchange type và tên
      const exchangeType = options.exchangeType || "direct";
      const exchangeName = options.exchange || config.rabbitmq.defaultExchange;

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
      const queue = options.queue || config.rabbitmq.defaultQueue;

      // Cấu hình Dead Letter Exchange nếu được yêu cầu
      const queueArguments = {};
      if (options.enableDeadLetter) {
        const dlxName = options.dlxName || "demo.dlx";
        const dlxRoutingKey = options.dlxRoutingKey || queue;

        // Khai báo Dead Letter Exchange
        await channel.assertExchange(dlxName, "direct", { durable: true });

        // Thêm cấu hình DLX vào queue arguments
        queueArguments["x-dead-letter-exchange"] = dlxName;
        queueArguments["x-dead-letter-routing-key"] = dlxRoutingKey;

        if (options.messageTtl) {
          queueArguments["x-message-ttl"] = options.messageTtl;
        }
      }

      // Cấu hình Priority Queue nếu được yêu cầu
      if (options.enablePriority) {
        queueArguments["x-max-priority"] = options.maxPriority || 10;
      }

      // Khai báo hàng đợi với các tùy chỉnh và arguments
      const queueOptions = {
        // durable: false - khớp với cấu hình queue hiện tại
        durable: options.durable !== undefined ? options.durable : false,
        // exclusive: true - chỉ cho phép kết nối hiện tại truy cập hàng đợi
        exclusive: options.exclusive || false,
        // autoDelete: true - tự động xóa hàng đợi khi không còn kết nối nào
        autoDelete: options.autoDelete || false,
        // arguments - các đối số bổ sung cho hàng đợi
        arguments: {
          ...queueArguments,
          ...options.queueArguments,
        },
      };

      // Nếu có deadLetterExchange, thêm vào arguments
      if (options.deadLetterExchange) {
        queueOptions.arguments = {
          ...queueOptions.arguments,
          "x-dead-letter-exchange": options.deadLetterExchange,
        };

        if (options.deadLetterRoutingKey) {
          queueOptions.arguments["x-dead-letter-routing-key"] =
            options.deadLetterRoutingKey;
        }
      }

      // Khai báo queue
      const queueResult = await channel.assertQueue(queue, queueOptions);

      // Nếu có exchange, bind queue với exchange
      if (exchangeName) {
        const routingKey = options.routingKey || queue;
        await channel.bindQueue(queue, exchangeName, routingKey);
      }

      // Chuẩn bị tin nhắn
      const content =
        typeof message === "object" ? JSON.stringify(message) : message;

      // Chuẩn bị các tùy chọn cho tin nhắn
      const messageOptions = {
        // persistent: true - tin nhắn sẽ được lưu trữ trên đĩa
        persistent:
          options.persistent !== undefined ? options.persistent : true,
        // expiration - thời gian sống của tin nhắn (ms)
        expiration: options.expiration,
        // contentType - kiểu dữ liệu của tin nhắn
        contentType: options.contentType || "application/json",
        // contentEncoding - kiểu mã hóa của tin nhắn
        contentEncoding: options.contentEncoding,
        // headers - các header tùy chỉnh
        headers: options.headers || {
          source: "demo-producer",
          timestamp: new Date().toISOString(),
        },
        // messageId - ID của tin nhắn
        messageId:
          options.messageId ||
          `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        // correlationId - ID tương quan (dùng cho RPC)
        correlationId: options.correlationId,
        // replyTo - queue để nhận phản hồi (dùng cho RPC)
        replyTo: options.replyTo,
        // priority - độ ưu tiên của tin nhắn (0-9, 9 là cao nhất)
        priority: options.priority,
      };

      // Gửi tin nhắn
      let result;
      if (exchangeName) {
        // Gửi qua exchange
        result = await channel.publish(
          exchangeName,
          options.routingKey || "",
          Buffer.from(content),
          messageOptions
        );
      } else {
        // Gửi trực tiếp đến queue
        result = await channel.sendToQueue(
          queue,
          Buffer.from(content),
          messageOptions
        );
      }

      // Nếu yêu cầu xác nhận, đợi xác nhận từ broker
      if (options.confirm) {
        // Bật chế độ confirm trên channel nếu chưa bật
        if (!channel.isConfirmChannel) {
          await channel.confirmChannel();
          channel.isConfirmChannel = true;
        }

        await new Promise((resolve, reject) => {
          // Đăng ký callback cho confirms và returns
          channel.on("ack", (seqId) => {
            console.log(
              `Tin nhắn với seqId ${seqId} đã được xác nhận bởi RabbitMQ`
            );
          });

          channel.on("nack", (seqId) => {
            console.warn(
              `Tin nhắn với seqId ${seqId} đã bị từ chối bởi RabbitMQ`
            );
          });

          channel.on("return", (msg) => {
            console.warn(
              `Tin nhắn đã bị trả lại: ${msg.content.toString()}, code: ${
                msg.fields.replyCode
              }`
            );
          });

          channel
            .waitForConfirms()
            .then(() => {
              console.log("Tất cả tin nhắn đã được xác nhận bởi RabbitMQ");
              resolve();
            })
            .catch((err) => {
              console.error(
                "Một số tin nhắn không được xác nhận bởi RabbitMQ:",
                err
              );
              reject(err);
            });
        });
      }

      return {
        success: true,
        queue,
        exchange: exchangeName || null,
        routingKey: options.routingKey || null,
        messageId: messageOptions.messageId,
      };
    } catch (error) {
      console.error("Lỗi khi gửi tin nhắn đến RabbitMQ:", error);
      throw error;
    }
  }

  /**
   * Gửi tin nhắn với độ ưu tiên
   * @param {String|Object} message - Tin nhắn cần gửi
   * @param {Number} priority - Độ ưu tiên (0-9, 9 là cao nhất)
   * @param {Object} options - Tùy chọn gửi tin nhắn
   * @returns {Object} Kết quả gửi tin nhắn
   */
  async sendWithPriority(message, priority, options = {}) {
    try {
      // Đảm bảo có kết nối
      const connected = await this.ensureConnection();
      if (!connected) {
        throw new Error(
          "Không thể kết nối đến RabbitMQ để gửi tin nhắn ưu tiên"
        );
      }

      const channel = this.channel;

      // Xác định exchange và queue
      const exchangeName = options.exchange || "";
      const queueName =
        options.queue || config.rabbitmq.defaultQueue || "priority-queue";

      // Khai báo queue với hỗ trợ priority
      const maxPriority = options.maxPriority || 10;
      await channel.assertQueue(queueName, {
        durable: false,
        arguments: {
          "x-max-priority": maxPriority,
          ...options.queueArguments,
        },
      });

      // Nếu có exchange, khai báo và bind
      if (exchangeName) {
        const exchangeType = options.exchangeType || "direct";
        await channel.assertExchange(exchangeName, exchangeType, {
          durable:
            options.durableExchange !== undefined
              ? options.durableExchange
              : true,
        });

        const routingKey = options.routingKey || "";
        await channel.bindQueue(queueName, exchangeName, routingKey);
      }

      // Chuẩn bị tin nhắn
      const content =
        typeof message === "object" ? JSON.stringify(message) : message;

      // Gửi tin nhắn với priority
      if (exchangeName) {
        await channel.publish(
          exchangeName,
          options.routingKey || "",
          Buffer.from(content),
          {
            persistent:
              options.persistent !== undefined ? options.persistent : true,
            priority: priority, // Độ ưu tiên của tin nhắn (0-9, 9 là cao nhất)
            ...options.publishOptions,
          }
        );
      } else {
        await channel.sendToQueue(queueName, Buffer.from(content), {
          persistent:
            options.persistent !== undefined ? options.persistent : true,
          priority: priority, // Độ ưu tiên của tin nhắn (0-9, 9 là cao nhất)
          ...options.publishOptions,
        });
      }

      return { success: true, priority, queue: queueName };
    } catch (error) {
      console.error("Lỗi khi gửi tin nhắn ưu tiên:", error);
      throw error;
    }
  }

  /**
   * Gửi tin nhắn đến Dead Letter Exchange khi xử lý thất bại
   * @param {String|Object} message - Tin nhắn cần gửi
   * @param {String} reason - Lý do gửi đến DLX
   * @param {Object} options - Tùy chọn gửi tin nhắn
   * @returns {Object} Kết quả gửi tin nhắn
   */
  async sendToDeadLetterExchange(message, reason, options = {}) {
    try {
      // Đảm bảo có kết nối
      const connected = await this.ensureConnection();
      if (!connected) {
        throw new Error(
          "Không thể kết nối đến RabbitMQ để gửi tin nhắn đến DLX"
        );
      }

      const channel = this.channel;

      // Khai báo Dead Letter Exchange
      const dlxName = options.dlxName || "demo.dlx";
      await channel.assertExchange(dlxName, "direct", { durable: true });

      // Khai báo Dead Letter Queue
      const dlqName = options.dlqName || "demo.dlq";
      const dlq = await channel.assertQueue(dlqName, {
        durable: true,
        arguments: {
          "x-message-ttl": options.messageTtl || 86400000, // 1 ngày mặc định
          "x-max-length": options.maxLength || 1000, // Giới hạn số lượng tin nhắn
        },
      });

      // Bind queue với exchange
      const routingKey = options.routingKey || "dead-letter";
      await channel.bindQueue(dlqName, dlxName, routingKey);

      // Chuẩn bị tin nhắn với metadata về lỗi
      const messageContent =
        typeof message === "object" ? message : { content: message };
      const deadLetterMessage = {
        ...messageContent,
        _dead_letter_info: {
          reason: reason,
          timestamp: new Date().toISOString(),
          retryCount: options.retryCount || 0,
          originalQueue: options.originalQueue || "unknown",
          originalExchange: options.originalExchange || "unknown",
        },
      };

      // Gửi tin nhắn đến Dead Letter Exchange
      await channel.publish(
        dlxName,
        routingKey,
        Buffer.from(JSON.stringify(deadLetterMessage)),
        {
          persistent: true,
          headers: {
            "x-dead-letter-reason": reason,
            ...options.headers,
          },
        }
      );

      return { success: true, dlx: dlxName, dlq: dlqName };
    } catch (error) {
      console.error("Lỗi khi gửi tin nhắn đến Dead Letter Exchange:", error);
      throw error;
    }
  }

  /**
   * Thực hiện các thao tác quản trị RabbitMQ
   * @param {String} action - Hành động cần thực hiện
   * @param {Object} options - Tùy chọn cho hành động
   * @returns {Object} Kết quả thực hiện
   */
  async adminAction(action, options = {}) {
    try {
      // Đảm bảo có kết nối
      const connected = await this.ensureConnection();
      if (!connected) {
        throw new Error(
          "Không thể kết nối đến RabbitMQ để thực hiện thao tác quản trị"
        );
      }

      const channel = this.channel;
      let result;

      switch (action) {
        case "create-exchange":
          // Tạo exchange mới
          if (!options?.name || !options?.type) {
            throw new Error("Exchange name and type are required");
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
            throw new Error("Queue name is required");
          }

          // Cấu hình queue arguments
          const queueArguments = options.arguments || {};

          // Cấu hình Dead Letter Exchange nếu được yêu cầu
          if (options.deadLetterExchange) {
            queueArguments["x-dead-letter-exchange"] =
              options.deadLetterExchange;
            if (options.deadLetterRoutingKey) {
              queueArguments["x-dead-letter-routing-key"] =
                options.deadLetterRoutingKey;
            }
          }

          // Cấu hình Priority Queue nếu được yêu cầu
          if (options.enablePriority) {
            queueArguments["x-max-priority"] = options.maxPriority || 10;
          }

          // Cấu hình Queue TTL nếu được yêu cầu
          if (options.messageTtl) {
            queueArguments["x-message-ttl"] = options.messageTtl;
          }

          // Cấu hình Queue Length Limit nếu được yêu cầu
          if (options.maxLength) {
            queueArguments["x-max-length"] = options.maxLength;
          }

          result = await channel.assertQueue(options.name, {
            durable: options.durable !== undefined ? options.durable : true,
            exclusive: options.exclusive || false,
            autoDelete: options.autoDelete || false,
            arguments: queueArguments,
          });
          break;

        case "bind-queue":
          // Bind queue với exchange
          if (!options?.queue || !options?.exchange) {
            throw new Error("Queue and exchange names are required");
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
            throw new Error("Queue name is required");
          }

          result = await channel.deleteQueue(options.name);
          break;

        case "delete-exchange":
          // Xóa exchange
          if (!options?.name) {
            throw new Error("Exchange name is required");
          }

          await channel.deleteExchange(options.name);
          result = { exchangeName: options.name, deleted: true };
          break;

        case "create-dlx":
          // Tạo Dead Letter Exchange và Queue
          if (!options?.exchange || !options?.queue) {
            throw new Error("Exchange and queue names are required");
          }

          // Khai báo Dead Letter Exchange
          await channel.assertExchange(
            options.exchange,
            options.exchangeType || "direct",
            {
              durable: options.durable !== undefined ? options.durable : true,
            }
          );

          // Khai báo Dead Letter Queue
          const dlq = await channel.assertQueue(options.queue, {
            durable: options.durable !== undefined ? options.durable : true,
            arguments: {
              "x-message-ttl": options.messageTtl || 86400000, // 1 ngày mặc định
              "x-max-length": options.maxLength || 1000, // Giới hạn số lượng tin nhắn
              ...options.queueArguments,
            },
          });

          // Bind queue với exchange
          await channel.bindQueue(
            options.queue,
            options.exchange,
            options.routingKey || "dead-letter"
          );

          result = {
            exchange: options.exchange,
            queue: options.queue,
            messageCount: dlq.messageCount,
            consumerCount: dlq.consumerCount,
          };
          break;

        case "purge-queue":
          // Xóa tất cả tin nhắn trong queue
          if (!options?.name) {
            throw new Error("Queue name is required");
          }

          result = await channel.purgeQueue(options.name);
          break;

        default:
          throw new Error(`Unknown action: ${action}`);
      }

      return { success: true, result };
    } catch (error) {
      console.error("Lỗi khi thực hiện thao tác quản trị RabbitMQ:", error);
      throw error;
    }
  }
}

module.exports = new RabbitMQService();

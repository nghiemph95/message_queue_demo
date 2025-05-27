/**
 * Producer API - Ứng dụng chính
 */
const express = require("express");
const bodyParser = require("body-parser");
const config = require("./config");

// Import services
const kafkaService = require("./services/kafka/kafka-service");
const rabbitMQService = require("./services/rabbitmq/rabbitmq-service");

// Import routes
const mainRoutes = require("./routes");
const kafkaRoutes = require("./routes/kafka-routes");
const rabbitmqRoutes = require("./routes/rabbitmq-routes");

// Khởi tạo Express app
const app = express();
app.use(bodyParser.json());

// Đăng ký routes
app.use("/", mainRoutes);
app.use("/kafka", kafkaRoutes);
app.use("/rabbitmq", rabbitmqRoutes);

// Xử lý lỗi
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: "Internal Server Error",
    message: err.message,
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
  });
});

// Khởi động server
const PORT = config.server.port;

// Hàm khởi động ứng dụng
async function startApp() {
  try {
    // Kết nối đến Kafka
    await kafkaService.connect();
    
    // Kết nối đến RabbitMQ
    await rabbitMQService.connect();
    
    // Khởi động server
    app.listen(PORT, () => {
      console.log(`Producer API running on port ${PORT}`);
      console.log(
        'Send messages using POST /send with JSON body: { "message": "Your message", "target": "kafka|rabbitmq|all" }'
      );
    });
    
    // Xử lý khi ứng dụng shutdown
    process.on("SIGINT", async () => {
      console.log("Shutting down gracefully...");
      
      try {
        // Đóng kết nối đến Kafka
        await kafkaService.disconnect();
        
        // Đóng kết nối đến RabbitMQ
        await rabbitMQService.close();
        
        console.log("All connections closed. Exiting...");
        process.exit(0);
      } catch (error) {
        console.error("Error during shutdown:", error);
        process.exit(1);
      }
    });
  } catch (error) {
    console.error("Failed to start application:", error);
    process.exit(1);
  }
}

// Khởi động ứng dụng
startApp();

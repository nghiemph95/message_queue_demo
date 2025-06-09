const { Kafka } = require("kafkajs");
require("dotenv").config();

// Import database service
const { connect, saveMessage, disconnect } = require('./services/db-service');

const kafka = new Kafka({
  clientId: "demo-consumer",
  brokers: [process.env.KAFKA_BROKER || 'kafka:29092'],
});

const consumer = kafka.consumer({ groupId: "test-group" });

// Tên collection để lưu message
const MESSAGE_COLLECTION = process.env.MESSAGE_COLLECTION || 'kafka_messages';

async function run() {
  try {
    // Kết nối đến MongoDB
    await connect();
    console.log('Đã kết nối đến cơ sở dữ liệu');
    
    // Kết nối đến Kafka
    await consumer.connect();
    await consumer.subscribe({
      topic: process.env.KAFKA_TOPIC || 'test-topic',
      fromBeginning: true,
    });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          // Parse message value
          const messageValue = message.value.toString();
          let messageData;
          
          try {
            // Thử parse JSON nếu message là JSON
            messageData = JSON.parse(messageValue);
          } catch (parseError) {
            // Nếu không phải JSON, sử dụng giá trị nguyên bản
            messageData = { rawValue: messageValue };
          }
          
          // Log thông tin message
          console.log({
            topic,
            partition,
            offset: message.offset,
            value: messageValue,
          });
          
          // Lưu message vào MongoDB
          const messageToSave = {
            topic,
            partition,
            offset: message.offset,
            data: messageData,
            headers: message.headers ? Object.fromEntries(
              Object.entries(message.headers).map(([key, value]) => [key, value.toString()])
            ) : {},
            timestamp: message.timestamp ? new Date(parseInt(message.timestamp)) : new Date()
          };
          
          const saveResult = await saveMessage(MESSAGE_COLLECTION, messageToSave);
          console.log(`Message đã được lưu vào DB với ID: ${saveResult.insertedId}`);
        } catch (processingError) {
          console.error('Lỗi khi xử lý message:', processingError);
        }
      },
    });
  } catch (error) {
    console.error('Lỗi khi khởi động consumer:', error);
    throw error;
  }
}

run().catch(console.error);
console.log('Kafka consumer is running...');

// Xử lý tắt ứng dụng
process.on('SIGINT', async () => {
  try {
    console.log('Đang đóng kết nối...');
    await consumer.disconnect();
    await disconnect();
    console.log('Đã đóng tất cả kết nối, thoát ứng dụng');
    process.exit(0);
  } catch (error) {
    console.error('Lỗi khi đóng kết nối:', error);
    process.exit(1);
  }
});

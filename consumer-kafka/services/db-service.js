const { MongoClient } = require("mongodb");
require("dotenv").config();

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017";
const dbName = process.env.MONGODB_DB || "message_queue_demo";

let client = null;
let db = null;
let connected = false;

async function connect(retryCount = 0) {
  try {
    client = new MongoClient(uri);
    await client.connect();
    db = client.db(dbName);
    connected = true;
    console.log("Kết nối thành công đến MongoDB");
    return true;
  } catch (error) {
    console.error("Lỗi khi kết nối đến MongoDB:", error.message);

    const maxRetries = 5;
    if (retryCount < maxRetries) {
      const delay = Math.pow(2, retryCount) * 1000;
      console.log(`Thử kết nối lại sau ${delay / 1000} giây...`);
      setTimeout(() => connect(retryCount + 1), delay);
    }

    connected = false;
    return false;
  }
}

async function saveMessage(collection, data) {
  if (!connected) {
    console.warn("MongoDB chưa được kết nối, đang thử kết nối lại...");
    const connectionResult = await connect();
    if (!connectionResult) {
      throw new Error("Không thể kết nối đến MongoDB để lưu dữ liệu");
    }
  }

  try {
    // Thêm metadata cho message
    const enrichedData = {
      ...data,
      receivedAt: new Date(),
      processed: true,
    };

    const result = await db.collection(collection).insertOne(enrichedData);
    return {
      success: true,
      insertedId: result.insertedId,
      data: enrichedData,
    };
  } catch (error) {
    console.error("Lỗi khi lưu dữ liệu vào MongoDB:", error);
    throw error;
  }
}

/**
 * Tìm kiếm message theo điều kiện
 * @param {String} collection - Tên collection
 * @param {Object} query - Điều kiện tìm kiếm
 * @param {Object} options - Tùy chọn tìm kiếm
 * @returns {Array} Danh sách message
 */
async function findMessages(collection, query = {}, options = {}) {
  if (!connected) {
    await connect();
  }

  try {
    const cursor = db.collection(collection).find(query, options);
    return await cursor.toArray();
  } catch (error) {
    console.error("Lỗi khi tìm kiếm dữ liệu:", error);
    throw error;
  }
}

/**
 * Đóng kết nối đến MongoDB
 */
async function disconnect() {
  try {
    if (client) {
      await client.close();
      console.log("Đã đóng kết nối đến MongoDB");
    }
    connected = false;
  } catch (error) {
    console.error("Lỗi khi đóng kết nối MongoDB:", error);
  }
}

// Export các hàm
module.exports = {
  connect,
  saveMessage,
  findMessages,
  disconnect,
};

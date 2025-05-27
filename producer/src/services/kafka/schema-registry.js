/**
 * Mô phỏng Schema Registry cho Kafka
 */

class SchemaRegistry {
  constructor() {
    this.schemas = new Map();
  }

  /**
   * Đăng ký schema mới
   * @param {Object} schema - Schema cần đăng ký
   * @param {String} subject - Tên subject
   * @returns {Object} Kết quả đăng ký với ID
   */
  async register(schema, subject) {
    console.log(`Đăng ký schema cho ${subject}:`, schema);
    const id = Math.floor(Math.random() * 1000);
    this.schemas.set(id, { schema, subject });
    return { id };
  }

  /**
   * Lấy schema theo ID
   * @param {Number} id - ID của schema
   * @returns {Object} Schema
   */
  async getById(id) {
    console.log(`Lấy schema với ID: ${id}`);
    if (this.schemas.has(id)) {
      return this.schemas.get(id);
    }
    
    // Giả lập schema mặc định nếu không tìm thấy
    return {
      schema: JSON.stringify({
        type: "record",
        name: "User",
        fields: [
          { name: "name", type: "string" },
          { name: "age", type: "int" },
        ],
      }),
    };
  }

  /**
   * Encode tin nhắn với schema
   * @param {Object} message - Tin nhắn cần encode
   * @param {Number} schemaId - ID của schema
   * @returns {Buffer} Tin nhắn đã encode
   */
  encode(message, schemaId) {
    console.log(`Encode tin nhắn với schema ID: ${schemaId}`, message);
    return Buffer.from(JSON.stringify(message));
  }

  /**
   * Decode tin nhắn với schema
   * @param {Buffer} buffer - Tin nhắn cần decode
   * @param {Number} schemaId - ID của schema
   * @returns {Object} Tin nhắn đã decode
   */
  decode(buffer, schemaId) {
    console.log(`Decode tin nhắn với schema ID: ${schemaId}`);
    return JSON.parse(buffer.toString());
  }
}

module.exports = new SchemaRegistry();

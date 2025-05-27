# Message Queue Demo with Kafka and RabbitMQ

A demo system using Kafka and RabbitMQ in a microservices architecture with advanced features.

## System Requirements

- Docker
- Docker Compose

## Project Structure

- `producer/`: Service that sends messages to Kafka and RabbitMQ through an API
  - Hỗ trợ các tính năng nâng cao: Transactional API, Schema Registry, Compacted Topics, Dead Letter Exchange, Priority Queue, và Publisher Confirms
  - Cấu trúc module hóa:
    - `src/config/`: Cấu hình chung cho ứng dụng
    - `src/services/kafka/`: Xử lý kết nối và gửi tin nhắn đến Kafka
    - `src/services/rabbitmq/`: Xử lý kết nối và gửi tin nhắn đến RabbitMQ
    - `src/routes/`: Các API endpoint
    - `src/app.js`: Ứng dụng Express chính
    - `index.js`: Entry point
- `consumer-kafka/`: Service that receives messages from Kafka
- `consumer-rabbitmq/`: Service that receives messages from RabbitMQ

## How to Run

1. Start the services:

   ```bash
   docker-compose up --build
   ```
   
   Hoặc chạy riêng producer service:
   
   ```bash
   cd producer
   node index.js
   ```

2. Access RabbitMQ Management UI:
   - URL: http://localhost:15672
   - Username: guest
   - Password: guest

## Using the API to Send Messages

The API is exposed on port 3000. You can use the following commands to send messages and manage Kafka/RabbitMQ:

### Check API Status

```bash
curl http://localhost:3000/health
```

## Basic Message Sending

### Send Message to Both Kafka and RabbitMQ

```bash
curl -X POST http://localhost:3000/send \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello World", "target": "all"}'
```

### Send to Kafka Only

```bash
curl -X POST http://localhost:3000/send \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello Kafka", "target": "kafka"}'
```

### Send to RabbitMQ Only

```bash
curl -X POST http://localhost:3000/send \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello RabbitMQ", "target": "rabbitmq"}'
```

## Advanced Message Sending

### Tính năng nâng cao

API mới `/send/advanced` hỗ trợ các tính năng nâng cao sau:

- Kafka: Transactional API, Schema Registry, Compacted Topics
- RabbitMQ: Dead Letter Exchange, Priority Queue, Publisher Confirms

### Gửi tin nhắn với Kafka Transaction

```bash
curl -X POST http://localhost:3000/send/advanced \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello Transaction",
    "feature": "kafka-transaction",
    "options": {
      "kafka": {
        "topic": "transaction-topic",
        "simulateError": false
      }
    }
  }'
```

### Gửi tin nhắn với Schema

```bash
curl -X POST http://localhost:3000/send/advanced \
  -H "Content-Type: application/json" \
  -d '{
    "message": {"name": "John", "age": 30},
    "feature": "kafka-schema",
    "options": {
      "schemaId": 123,
      "kafka": {
        "topic": "user-events"
      }
    }
  }'
```

### Gửi tin nhắn với độ ưu tiên trong RabbitMQ

```bash
curl -X POST http://localhost:3000/send/advanced \
  -H "Content-Type: application/json" \
  -d '{
    "message": "High Priority Message",
    "feature": "rabbitmq-priority",
    "options": {
      "priority": 9,
      "rabbitmq": {
        "queue": "priority-queue",
        "maxPriority": 10
      }
    }
  }'
```

### Gửi tin nhắn đến Dead Letter Exchange

```bash
curl -X POST http://localhost:3000/send/advanced \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Failed Message",
    "feature": "rabbitmq-dlx",
    "options": {
      "reason": "processing-error",
      "rabbitmq": {
        "dlxName": "demo.dlx",
        "dlqName": "demo.dlq",
        "originalQueue": "original-queue"
      }
    }
  }'
```

### Send to Kafka with Advanced Options

```bash
curl -X POST http://localhost:3000/send \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello Advanced Kafka",
    "target": "kafka",
    "options": {
      "kafka": {
        "key": "user-123",
        "acks": -1,
        "compression": 1,
        "topic": "custom-topic"
      }
    }
  }'
```

### Send to RabbitMQ with Exchange and Routing Key

```bash
curl -X POST http://localhost:3000/send \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello Advanced RabbitMQ",
    "target": "rabbitmq",
    "options": {
      "rabbitmq": {
        "exchange": "notifications",
        "exchangeType": "topic",
        "routingKey": "email.important",
        "persistent": true,
        "confirm": true,
        "durable": false
      }
    }
  }'
```

### Send Batch Messages to Kafka

```bash
curl -X POST http://localhost:3000/send \
  -H "Content-Type: application/json" \
  -d '{
    "message": [
      "Message 1",
      "Message 2",
      "Message 3"
    ],
    "target": "kafka"
  }'
```

### Send JSON Object as Message

```bash
curl -X POST http://localhost:3000/send \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "id": 123,
      "name": "Test User",
      "email": "test@example.com"
    },
    "target": "all"
  }'
```

## Kafka Admin Operations

### Đăng ký Schema mới

```bash
curl -X POST http://localhost:3000/kafka/admin \
  -H "Content-Type: application/json" \
  -d '{
    "action": "register-schema",
    "options": {
      "schema": {
        "type": "record",
        "name": "User",
        "fields": [
          { "name": "name", "type": "string" },
          { "name": "age", "type": "int" }
        ]
      },
      "subject": "user-value"
    }
  }'
```

### Tạo Compacted Topic

```bash
curl -X POST http://localhost:3000/kafka/admin \
  -H "Content-Type: application/json" \
  -d '{
    "action": "create-compacted-topic",
    "options": {
      "topic": "user-profiles",
      "numPartitions": 3,
      "replicationFactor": 1,
      "minCompactionLag": "60000",
      "maxCompactionLag": "86400000"
    }
  }'
```

### Create a New Kafka Topic

```bash
curl -X POST http://localhost:3000/kafka/admin \
  -H "Content-Type: application/json" \
  -d '{
    "action": "create-topic",
    "options": {
      "topic": "new-topic",
      "numPartitions": 3,
      "replicationFactor": 1
    }
  }'
```

### List All Kafka Topics

```bash
curl -X POST http://localhost:3000/kafka/admin \
  -H "Content-Type: application/json" \
  -d '{
    "action": "list-topics"
  }'
```

### Get Topic Metadata

```bash
curl -X POST http://localhost:3000/kafka/admin \
  -H "Content-Type: application/json" \
  -d '{
    "action": "topic-metadata",
    "options": {
      "topics": ["test-topic"]
    }
  }'
```

## RabbitMQ Admin Operations

### Tạo Dead Letter Exchange và Queue

```bash
curl -X POST http://localhost:3000/rabbitmq/admin \
  -H "Content-Type: application/json" \
  -d '{
    "action": "create-dlx",
    "options": {
      "exchange": "demo.dlx",
      "queue": "demo.dlq",
      "routingKey": "dead-letter",
      "messageTtl": 86400000,
      "maxLength": 1000
    }
  }'
```

### Tạo Priority Queue

```bash
curl -X POST http://localhost:3000/rabbitmq/admin \
  -H "Content-Type: application/json" \
  -d '{
    "action": "create-queue",
    "options": {
      "name": "priority-queue",
      "durable": true,
      "enablePriority": true,
      "maxPriority": 10
    }
  }'
```

### Xóa tất cả tin nhắn trong Queue

```bash
curl -X POST http://localhost:3000/rabbitmq/admin \
  -H "Content-Type: application/json" \
  -d '{
    "action": "purge-queue",
    "options": {
      "name": "test-queue"
    }
  }'
```

### Create a New Exchange

```bash
curl -X POST http://localhost:3000/rabbitmq/admin \
  -H "Content-Type: application/json" \
  -d '{
    "action": "create-exchange",
    "options": {
      "name": "notifications",
      "type": "topic",
      "durable": true
    }
  }'
```

### Create a New Queue

```bash
curl -X POST http://localhost:3000/rabbitmq/admin \
  -H "Content-Type: application/json" \
  -d '{
    "action": "create-queue",
    "options": {
      "name": "email-notifications",
      "durable": true,
      "arguments": {
        "x-message-ttl": 86400000
      }
    }
  }'
```

### Bind Queue to Exchange

```bash
curl -X POST http://localhost:3000/rabbitmq/admin \
  -H "Content-Type: application/json" \
  -d '{
    "action": "bind-queue",
    "options": {
      "queue": "email-notifications",
      "exchange": "notifications",
      "routingKey": "email.#"
    }
  }'
```

### Delete Queue

```bash
curl -X POST http://localhost:3000/rabbitmq/admin \
  -H "Content-Type: application/json" \
  -d '{
    "action": "delete-queue",
    "options": {
      "name": "email-notifications"
    }
  }'
```

### Delete Exchange

```bash
curl -X POST http://localhost:3000/rabbitmq/admin \
  -H "Content-Type: application/json" \
  -d '{
    "action": "delete-exchange",
    "options": {
      "name": "notifications"
    }
  }'
```

## View Service Logs

You can view the logs of each service using the following commands:

```bash
docker-compose logs -f producer
docker-compose logs -f consumer-kafka
docker-compose logs -f consumer-rabbitmq
```

## Tính năng nâng cao

### Kafka

#### Transactional API
- Hỗ trợ gửi tin nhắn trong một giao dịch (transaction)
- Đảm bảo tính nhất quán với commit và abort
- Hỗ trợ exactly-once semantics
- API: `/kafka/transaction`

#### Schema Registry
- Quản lý và đăng ký schema cho tin nhắn
- Đảm bảo tương thích giữa producer và consumer
- Hỗ trợ schema evolution
- API: `/kafka/schema`

#### Compacted Topics
- Lưu trữ trạng thái mới nhất của key
- Tối ưu hóa không gian lưu trữ
- Phù hợp cho các use case như changelog và event sourcing
- API: `/kafka/admin` với action `create-compacted-topic`

### RabbitMQ

#### Dead Letter Exchange (DLX)
- Xử lý tin nhắn không thể xử lý
- Tự động thêm metadata về lỗi
- Hỗ trợ retry logic
- API: `/rabbitmq/dlx`

#### Priority Queue
- Gửi tin nhắn với độ ưu tiên khác nhau
- Xử lý tin nhắn quan trọng trước
- Cấu hình mức độ ưu tiên tùy chỉnh
- API: `/rabbitmq/priority`

#### Publisher Confirms
- Đảm bảo tin nhắn được gửi thành công
- Xử lý tin nhắn bị từ chối hoặc trả lại
- Cải thiện độ tin cậy của hệ thống
- Sử dụng option `confirm: true` trong các API gửi tin nhắn

## Cấu trúc module Producer

```
producer/
├── index.js                  # Entry point cho ứng dụng
├── src/
    ├── app.js                # Ứng dụng Express chính
    ├── config/
    │   └── index.js          # Cấu hình chung cho ứng dụng
    ├── services/
    │   ├── kafka/
    │   │   ├── kafka-service.js    # Xử lý kết nối và gửi tin nhắn đến Kafka
    │   │   └── schema-registry.js  # Mô phỏng Schema Registry
    │   └── rabbitmq/
    │       └── rabbitmq-service.js # Xử lý kết nối và gửi tin nhắn đến RabbitMQ
    └── routes/
        ├── index.js           # Route chính cho API
        ├── kafka-routes.js    # Route cho Kafka API
        └── rabbitmq-routes.js # Route cho RabbitMQ API
```

Lợi ích của cấu trúc mới:

1. **Dễ bảo trì**: Mỗi module có trách nhiệm cụ thể, dễ dàng sửa đổi và mở rộng
2. **Tái sử dụng code**: Các service có thể được tái sử dụng ở nhiều nơi
3. **Dễ test**: Có thể test từng module riêng biệt
4. **Dễ mở rộng**: Thêm tính năng mới không ảnh hưởng đến code hiện tại
5. **Rõ ràng hơn**: Cấu trúc rõ ràng giúp hiểu code nhanh hơn

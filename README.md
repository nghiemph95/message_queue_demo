# Message Queue Demo with Kafka and RabbitMQ

A demo system using Kafka and RabbitMQ in a microservices architecture with advanced features and improved error handling.

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
      "maxCompactionLag": "3600000"
    }
  }'
```

### Tăng số lượng partition cho topic

```bash
curl -X POST http://localhost:3000/kafka/admin \
  -H "Content-Type: application/json" \
  -d '{
    "action": "update-partitions",
    "options": {
      "topic": "test-topic",
      "numPartitions": 12
    }
  }'
```

### Lấy thông tin offset của các partition

```bash
curl -X POST http://localhost:3000/kafka/admin \
  -H "Content-Type: application/json" \
  -d '{
    "action": "partition-offsets",
    "options": {
      "topic": "test-topic"
    }
  }'
```

### Theo dõi độ trễ (lag) của consumer

```bash
curl -X POST http://localhost:3000/kafka/admin \
  -H "Content-Type: application/json" \
  -d '{
    "action": "consumer-lag",
    "options": {
      "topic": "test-topic",
      "groupId": "test-consumer-group"
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
- Cải thiện xử lý lỗi với retry và exponential backoff
- Tự động khởi tạo transaction coordinator
- Tự động tạo topic nếu chưa tồn tại
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

#### Quản lý Partition
- Tăng số lượng partition cho topic hiện có
- Lấy thông tin offset của các partition
- API: `/kafka/admin` với action `update-partitions` và `partition-offsets`

#### Giám sát Consumer Lag
- Theo dõi độ trễ giữa producer và consumer
- Tính toán lag cho từng partition và tổng lag
- Phân tích hiệu suất của consumer group
- API: `/kafka/admin` với action `consumer-lag`

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

## Cập nhật mới

### Route mới trong Kafka API

- **update-partitions**: Tăng số lượng partition cho topic hiện có
- **partition-offsets**: Lấy thông tin chi tiết về offset của các partition trong topic
- **consumer-lag**: Tính toán và hiển thị độ trễ (lag) của consumer group

Các route mới này giúp quản lý và giám sát hiệu suất của Kafka tốt hơn, đặc biệt trong việc tối ưu hóa số lượng partition và theo dõi hiệu suất của consumer.

### Cải thiện xử lý lỗi Kafka Transaction

- **Khởi tạo Transaction**: Thêm `initTransactions()` để khởi tạo transaction coordinator
- **Retry với Exponential Backoff**: Tự động thử lại kết nối khi gặp lỗi
- **Xử lý lỗi chi tiết**: Phân loại và xử lý từng loại lỗi cụ thể
- **Kiểm tra Topic**: Tự động kiểm tra và tạo topic nếu chưa tồn tại
- **Cấu hình nâng cao**: Thêm các tùy chọn như `allowAutoTopicCreation` và `retry`

### Cấu hình RabbitMQ

- **Cấu hình Queue**: Sửa tham số `durable` để đảm bảo tương thích với queue hiện có
- **Xử lý lỗi PRECONDITION_FAILED**: Giải quyết vấn đề không khớp cấu hình giữa queue đã tồn tại và khai báo mới

### Kế hoạch phát triển tương lai

#### Dashboard giám sát

Dự kiến phát triển dashboard để theo dõi lưu lượng dữ liệu trong hệ thống với các tính năng:

- **Thu thập metrics**: Số lượng tin nhắn, thời gian xử lý, phân phối theo topic/queue
- **API endpoints**: Cung cấp các endpoint để truy xuất metrics
- **Giao diện trực quan**: Biểu đồ và bảng điều khiển để theo dõi hiệu suất
- **Cảnh báo**: Thông báo khi phát hiện vấn đề

Dự kiến triển khai theo các bước:
1. Thu thập metrics cơ bản
2. Xây dựng dashboard đơn giản
3. Tích hợp với Kafka/RabbitMQ Admin API
4. Cải thiện và mở rộng

## Tích hợp Kafka với Cơ sở dữ liệu

Hệ thống này hỗ trợ ba phương pháp tích hợp Kafka với cơ sở dữ liệu:

1. **Consumer-based Integration**: Đã triển khai trong `consumer-kafka`
2. **Kafka Sink Connector**: Đưa dữ liệu từ Kafka vào MongoDB
3. **Kafka Source Connector**: Đưa dữ liệu từ MongoDB vào Kafka

### Cài đặt và Cấu hình Kafka Connect

Để sử dụng Kafka Sink và Source Connector, cần cài đặt Kafka Connect và các connector plugin. Đã cấu hình sẵn trong `docker-compose.yml`.

### Khởi chạy Kafka Sink Connector

Kafka Sink Connector giúp đưa dữ liệu từ Kafka topic vào MongoDB mà không cần viết code consumer.

1. **Tạo file cấu hình Sink Connector**:

```json
{
  "name": "mongodb-sink-connector",
  "config": {
    "connector.class": "com.mongodb.kafka.connect.MongoSinkConnector",
    "topics": "test-topic",
    "connection.uri": "mongodb://root:example@mongodb:27017",
    "database": "message_queue_demo",
    "collection": "kafka_messages_sink",
    "key.converter": "org.apache.kafka.connect.json.JsonConverter",
    "value.converter": "org.apache.kafka.connect.json.JsonConverter",
    "key.converter.schemas.enable": false,
    "value.converter.schemas.enable": false,
    "transforms": "RenameField",
    "transforms.RenameField.type": "org.apache.kafka.connect.transforms.ReplaceField$Value",
    "transforms.RenameField.renames": "value:message_value",
    "document.id.strategy": "com.mongodb.kafka.connect.sink.processor.id.strategy.UuidStrategy",
    "writemodel.strategy": "com.mongodb.kafka.connect.sink.writemodel.strategy.DefaultWriteModelStrategy"
  }
}
```

2. **Triển khai Sink Connector thông qua REST API**:

```bash
curl -X POST -H "Content-Type: application/json" --data @mongodb-sink-connector.json http://localhost:8083/connectors
```

3. **Kiểm tra trạng thái của connector**:

```bash
curl -s http://localhost:8083/connectors/mongodb-sink-connector/status | jq
```

4. **Gửi message đến Kafka để kiểm tra**:

```bash
curl -X POST http://localhost:3000/kafka/send -H 'Content-Type: application/json' -d '{"message": "Test message for Kafka Sink Connector"}'
```

5. **Kiểm tra dữ liệu trong MongoDB**:
   - Truy cập MongoDB Express: http://localhost:8081
   - Đăng nhập với username: admin, password: pass
   - Chọn database 'message_queue_demo' và collection 'kafka_messages_sink'

### Khởi chạy Kafka Source Connector

Kafka Source Connector giúp đưa dữ liệu từ MongoDB vào Kafka topic mà không cần viết code producer.

1. **Tạo file cấu hình Source Connector**:

```json
{
  "name": "mongodb-source-connector",
  "config": {
    "connector.class": "com.mongodb.kafka.connect.MongoSourceConnector",
    "connection.uri": "mongodb://root:example@mongodb:27017",
    "database": "message_queue_demo",
    "collection": "source_data",
    "topic.prefix": "mongodb",
    "poll.max.batch.size": 1000,
    "poll.await.time.ms": 5000,
    "publish.full.document.only": true,
    "key.converter": "org.apache.kafka.connect.json.JsonConverter",
    "value.converter": "org.apache.kafka.connect.json.JsonConverter",
    "key.converter.schemas.enable": false,
    "value.converter.schemas.enable": false
  }
}
```

2. **Tạo collection source_data trong MongoDB**:

```bash
docker exec -it mongodb mongosh -u root -p example --eval 'use message_queue_demo; db.createCollection("source_data")'
```

3. **Triển khai Source Connector thông qua REST API**:

```bash
curl -X POST -H "Content-Type: application/json" --data @mongodb-source-connector.json http://localhost:8083/connectors
```

4. **Kiểm tra trạng thái của connector**:

```bash
curl -s http://localhost:8083/connectors/mongodb-source-connector/status | jq
```

5. **Thêm dữ liệu vào MongoDB để kiểm tra**:

```bash
docker exec -it mongodb mongosh -u root -p example --eval 'use message_queue_demo; db.source_data.insertOne({name: "Test Document", value: "This is a test for Kafka Source Connector", timestamp: new Date()})'
```

6. **Kiểm tra message trong Kafka topic**:

```bash
docker exec -it kafka kafka-console-consumer --bootstrap-server kafka:29092 --topic mongodb.message_queue_demo.source_data --from-beginning
```

### So sánh các phương pháp tích hợp

| Tiêu chí | Consumer-based Integration | Kafka Sink Connector | Kafka Source Connector |
|----------|---------------------------|---------------------|----------------------|
| **Mức độ tùy chỉnh** | Cao | Trung bình | Trung bình |
| **Độ phức tạp triển khai** | Trung bình | Thấp | Thấp |
| **Khả năng mở rộng** | Thấp | Cao | Cao |
| **Xử lý lỗi tự động** | Phải tự xử lý | Có sẵn | Có sẵn |
| **Quản lý offset** | Phải tự xử lý | Tự động | Tự động |
| **Monitoring** | Phải tự triển khai | Có sẵn | Có sẵn |
| **Phù hợp với** | Dự án nhỏ, cần logic tùy chỉnh | Hệ thống lớn, cần độ tin cậy cao | Đồng bộ dữ liệu giữa các hệ thống |

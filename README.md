# Message Queue Demo with Kafka and RabbitMQ

A demo system using Kafka and RabbitMQ in a microservices architecture.

## System Requirements

- Docker
- Docker Compose

## Project Structure

- `producer/`: Service that sends messages to Kafka and RabbitMQ through an API
- `consumer-kafka/`: Service that receives messages from Kafka
- `consumer-rabbitmq/`: Service that receives messages from RabbitMQ

## How to Run

1. Start the services:

   ```bash
   docker-compose up --build
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

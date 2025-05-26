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

## Using the API to Send Messages Manually

The API is exposed on port 3000. You can use the following commands to send messages:

### Check API Status

```bash
curl http://localhost:3000/health
```

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

## View Service Logs

You can view the logs of each service using the following commands:

```bash
docker-compose logs -f producer
docker-compose logs -f consumer-kafka
docker-compose logs -f consumer-rabbitmq
```

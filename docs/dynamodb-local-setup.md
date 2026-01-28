# DynamoDB Local: Create Tables (tool-qrcode)

This doc is for setting up **DynamoDB Local** and creating the required tables for the QR Token MVP.

## Prerequisites
- Docker installed and working
- Repo uses `sam local` with docker network `sam-local`

---

## 1) Start DynamoDB Local

```bash
docker network create sam-local 2>/dev/null || true
docker rm -f dynamodb-local 2>/dev/null || true

docker run -d --name dynamodb-local \
  --network sam-local \
  -p 8000:8000 \
  amazon/dynamodb-local
```
check if running
```
docker ps | grep dynamodb-local
```


## table set up

### VirtualCardsTable
- PK: virtualCardId
- GSI: UserIndex (userId)
```
docker run --rm --network sam-local \
  -e AWS_ACCESS_KEY_ID=local \
  -e AWS_SECRET_ACCESS_KEY=local \
  -e AWS_DEFAULT_REGION=us-east-1 \
  amazon/aws-cli dynamodb create-table \
  --table-name VirtualCardsTable \
  --billing-mode PAY_PER_REQUEST \
  --attribute-definitions \
    AttributeName=virtualCardId,AttributeType=S \
    AttributeName=userId,AttributeType=S \
  --key-schema AttributeName=virtualCardId,KeyType=HASH \
  --global-secondary-indexes \
    "IndexName=UserIndex,KeySchema=[{AttributeName=userId,KeyType=HASH}],Projection={ProjectionType=ALL}" \
  --endpoint-url http://dynamodb-local:8000
```

### QrTokensTable

- PK: virtualCardId
- SK: tokenId

```
docker run --rm --network sam-local \
  -e AWS_ACCESS_KEY_ID=local \
  -e AWS_SECRET_ACCESS_KEY=local \
  -e AWS_DEFAULT_REGION=us-east-1 \
  amazon/aws-cli dynamodb create-table \
  --table-name QrTokensTable \
  --billing-mode PAY_PER_REQUEST \
  --attribute-definitions \
    AttributeName=virtualCardId,AttributeType=S \
    AttributeName=tokenId,AttributeType=S \
  --key-schema \
    AttributeName=virtualCardId,KeyType=HASH \
    AttributeName=tokenId,KeyType=RANGE \
  --endpoint-url http://dynamodb-local:8000
```

### PhysicalCardsTable

- PK: physicalQrHash
- GSI: VirtualCardIndex (virtualCardId)
```
docker run --rm --network sam-local \
  -e AWS_ACCESS_KEY_ID=local \
  -e AWS_SECRET_ACCESS_KEY=local \
  -e AWS_DEFAULT_REGION=us-east-1 \
  amazon/aws-cli dynamodb create-table \
  --table-name PhysicalCardsTable \
  --billing-mode PAY_PER_REQUEST \
  --attribute-definitions \
    AttributeName=physicalQrHash,AttributeType=S \
    AttributeName=virtualCardId,AttributeType=S \
  --key-schema AttributeName=physicalQrHash,KeyType=HASH \
  --global-secondary-indexes \
    "IndexName=VirtualCardIndex,KeySchema=[{AttributeName=virtualCardId,KeyType=HASH}],Projection={ProjectionType=ALL}" \
  --endpoint-url http://dynamodb-local:8000

```

### Verify the table

```
docker run --rm --network sam-local \
  -e AWS_ACCESS_KEY_ID=local \
  -e AWS_SECRET_ACCESS_KEY=local \
  -e AWS_DEFAULT_REGION=us-east-1 \
  amazon/aws-cli dynamodb list-tables \
  --endpoint-url http://dynamodb-local:8000
```
### Expected:

- VirtualCardsTable
- QrTokensTable
- PhysicalCardsTable


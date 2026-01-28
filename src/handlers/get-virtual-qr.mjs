import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: process.env.AWS_REGION || "us-east-1",
    endpoint: process.env.DDB_ENDPOINT,
    credentials: process.env.DDB_ENDPOINT
      ? { accessKeyId: process.env.AWS_ACCESS_KEY_ID || "local", secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "local" }
      : undefined,
  })
);

const VIRTUAL_CARDS_TABLE = process.env.VIRTUAL_CARDS_TABLE;
const TOKENS_TABLE = process.env.TOKENS_TABLE;

async function getVirtualCard({ virtualCardId, userId }) {
  if (virtualCardId) {
    const res = await ddb.send(new GetCommand({
      TableName: VIRTUAL_CARDS_TABLE,
      Key: { virtualCardId },
    }));
    return res.Item || null;
  }

  // fallback: pick first virtual card for user
  const res = await ddb.send(new QueryCommand({
    TableName: VIRTUAL_CARDS_TABLE,
    IndexName: "UserIndex",
    KeyConditionExpression: "userId = :u",
    ExpressionAttributeValues: { ":u": userId },
    Limit: 1,
  }));
  return res.Items?.[0] || null;
}

export async function handler(event) {
  try {
    console.log("ENV_CHECK", {
  AWS_REGION: process.env.AWS_REGION,
  DDB_ENDPOINT: process.env.DDB_ENDPOINT,
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  HAS_SECRET: Boolean(process.env.AWS_SECRET_ACCESS_KEY),
  VIRTUAL_CARDS_TABLE: process.env.VIRTUAL_CARDS_TABLE,
  PHYSICAL_CARDS_TABLE: process.env.PHYSICAL_CARDS_TABLE,
  TOKENS_TABLE: process.env.TOKENS_TABLE,
});

    const qs = event.queryStringParameters || {};
    const userId = qs.userId;
    const virtualCardId = qs.virtualCardId;

    if (!userId && !virtualCardId) {
      return { statusCode: 400, body: JSON.stringify({ error: "userId or virtualCardId is required" }) };
    }

    const card = await getVirtualCard({ virtualCardId, userId });
    if (!card) return { statusCode: 404, body: JSON.stringify({ error: "VIRTUAL_CARD_NOT_FOUND" }) };
    if (userId && card.userId !== userId) return { statusCode: 403, body: JSON.stringify({ error: "NOT_OWNER" }) };
    if (card.status !== "ACTIVE") return { statusCode: 403, body: JSON.stringify({ error: "VIRTUAL_CARD_BLOCKED" }) };

    const tokenId = card.currentTokenId;
    if (!tokenId) return { statusCode: 500, body: JSON.stringify({ error: "CURRENT_TOKEN_MISSING" }) };

    const tokenRes = await ddb.send(new GetCommand({
      TableName: TOKENS_TABLE,
      Key: { virtualCardId: card.virtualCardId, tokenId },
    }));

    if (!tokenRes.Item) return { statusCode: 404, body: JSON.stringify({ error: "TOKEN_NOT_FOUND" }) };

    return {
      statusCode: 200,
      body: JSON.stringify({
        virtualCardId: card.virtualCardId,
        virtualQrToken: tokenRes.Item.tokenValue, // frontend renders this QR
        paymentMethodId: card.paymentMethodId,
      }),
    };
  } catch (err) {
    console.error("GET_VIRTUAL_QR_ERROR", err);
    return { statusCode: 500, body: JSON.stringify({ name: err?.name, message: err?.message }) };
  }
}

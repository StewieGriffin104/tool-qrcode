import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  UpdateCommand,
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

function nowSec() { return Math.floor(Date.now() / 1000); }

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

    const body = event.body ? JSON.parse(event.body) : {};
    const userId = body.userId;
    const virtualCardId = body.virtualCardId;
    const paymentMethodId = body.paymentMethodId;

    if (!userId) return { statusCode: 400, body: JSON.stringify({ error: "userId is required" }) };
    if (!virtualCardId) return { statusCode: 400, body: JSON.stringify({ error: "virtualCardId is required" }) };
    if (paymentMethodId === undefined || paymentMethodId === null) {
      return { statusCode: 400, body: JSON.stringify({ error: "paymentMethodId is required" }) };
    }

    const paymentId = String(paymentMethodId);
    const ts = nowSec();

    // Update only if owner matches
    await ddb.send(new UpdateCommand({
      TableName: VIRTUAL_CARDS_TABLE,
      Key: { virtualCardId },
      UpdateExpression: "SET paymentMethodId = :p, updatedAt = :u",
      ConditionExpression: "userId = :uid",
      ExpressionAttributeValues: { ":p": paymentId, ":u": ts, ":uid": userId },
    }));

    return {
      statusCode: 200,
      body: JSON.stringify({ virtualCardId, paymentMethodId: paymentId, updated: true }),
    };
  } catch (err) {
    console.error("UPDATE_PAYMENT_ERROR", err);
    const code = err?.name === "ConditionalCheckFailedException" ? 403 : 500;
    return { statusCode: code, body: JSON.stringify({ name: err?.name, message: err?.message }) };
  }
}

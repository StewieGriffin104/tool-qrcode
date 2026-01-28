import crypto from "crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: process.env.AWS_REGION || "us-east-1",
    endpoint: process.env.DDB_ENDPOINT, // set for local; omit in AWS
    credentials: process.env.DDB_ENDPOINT
      ? { accessKeyId: process.env.AWS_ACCESS_KEY_ID || "local", secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "local" }
      : undefined,
  })
);

const VIRTUAL_CARDS_TABLE = process.env.VIRTUAL_CARDS_TABLE;
const TOKENS_TABLE = process.env.TOKENS_TABLE;

function nowSec() { return Math.floor(Date.now() / 1000); }
function uuid() { return crypto.randomUUID(); }
function genToken(prefix) {
  // 32 bytes => 256-bit entropy, extremely low collision risk
  const raw = crypto.randomBytes(32).toString("base64url");
  return `${prefix}${raw}`;
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

    const body = event.body ? JSON.parse(event.body) : {};
    const userId = body.userId;
    const paymentMethodId = body.paymentMethodId;

    if (!userId) return { statusCode: 400, body: JSON.stringify({ error: "userId is required" }) };
    if (paymentMethodId === undefined || paymentMethodId === null) {
      return { statusCode: 400, body: JSON.stringify({ error: "paymentMethodId is required" }) };
    }

    // simple payment id: allow int/string but store as string for flexibility
    const paymentId = String(paymentMethodId);

    const virtualCardId = uuid();
    const tokenId = uuid();
    const virtualQrToken = genToken("vqr_");
    const ts = nowSec();

    // Atomic: create card + create current token + set pointer
    await ddb.send(new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: VIRTUAL_CARDS_TABLE,
            Item: {
              virtualCardId,
              userId,
              paymentMethodId: paymentId,
              status: "ACTIVE",
              currentTokenId: tokenId,
              createdAt: ts,
              updatedAt: ts,
            },
            ConditionExpression: "attribute_not_exists(virtualCardId)",
          },
        },
        {
          Put: {
            TableName: TOKENS_TABLE,
            Item: {
              virtualCardId,
              tokenId,
              tokenValue: virtualQrToken,
              status: "ACTIVE",
              createdAt: ts,
            },
            ConditionExpression: "attribute_not_exists(virtualCardId) AND attribute_not_exists(tokenId)",
          },
        },
      ],
    }));

    return {
      statusCode: 200,
      body: JSON.stringify({
        virtualCardId,
        virtualQrToken,     // frontend renders this into QR
        paymentMethodId: paymentId,
      }),
    };
  } catch (err) {
    console.error("CREATE_VIRTUAL_CARD_ERROR", err);
    return { statusCode: 500, body: JSON.stringify({ name: err?.name, message: err?.message }) };
  }
}

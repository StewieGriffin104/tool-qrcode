import crypto from "crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
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
const PHYSICAL_CARDS_TABLE = process.env.PHYSICAL_CARDS_TABLE;

function nowSec() { return Math.floor(Date.now() / 1000); }
function sha256Hex(s) { return crypto.createHash("sha256").update(s).digest("hex"); }
function genPhysicalToken() {
  const raw = crypto.randomBytes(32).toString("base64url");
  return `pqr_${raw}`;
}

export async function handler(event) {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const userId = body.userId;
    const virtualCardId = body.virtualCardId;

    if (!userId) return { statusCode: 400, body: JSON.stringify({ error: "userId is required" }) };
    if (!virtualCardId) return { statusCode: 400, body: JSON.stringify({ error: "virtualCardId is required" }) };

    // Ownership check: physical must bind to user's virtual card
    const vc = await ddb.send(new GetCommand({
      TableName: VIRTUAL_CARDS_TABLE,
      Key: { virtualCardId },
    }));

    if (!vc.Item) return { statusCode: 404, body: JSON.stringify({ error: "VIRTUAL_CARD_NOT_FOUND" }) };
    if (vc.Item.userId !== userId) return { statusCode: 403, body: JSON.stringify({ error: "NOT_OWNER" }) };
    if (vc.Item.status !== "ACTIVE") return { statusCode: 403, body: JSON.stringify({ error: "VIRTUAL_CARD_BLOCKED" }) };

    // Physical QR token (fixed)
    const physicalQrToken = genPhysicalToken();
    const physicalQrHash = sha256Hex(physicalQrToken);
    const ts = nowSec();

    // Store only hash as primary key; returning raw token once for printing.
    await ddb.send(new PutCommand({
      TableName: PHYSICAL_CARDS_TABLE,
      Item: {
        physicalQrHash,
        virtualCardId,
        userId,
        status: "ACTIVE",
        createdAt: ts,
      },
      ConditionExpression: "attribute_not_exists(physicalQrHash)",
    }));

    return {
      statusCode: 200,
      body: JSON.stringify({
        physicalQrToken, // frontend/printing service renders this into a physical QR image
        physicalQrHash,
        virtualCardId,
      }),
    };
  } catch (err) {
    console.error("ISSUE_PHYSICAL_QR_ERROR", err);
    return { statusCode: 500, body: JSON.stringify({ name: err?.name, message: err?.message }) };
  }
}

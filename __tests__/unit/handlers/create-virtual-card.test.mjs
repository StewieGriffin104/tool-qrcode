import { jest } from "@jest/globals";

jest.unstable_mockModule("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: jest.fn(() => ({})),
}));

const sendMock = jest.fn();

jest.unstable_mockModule("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => ({ send: sendMock })),
  },
  PutCommand: jest.fn((x) => x),
}));

const { handler } = await import("../../../src/handlers/create-virtual-card.mjs");

describe("create-virtual-card handler", () => {
  beforeEach(() => {
    sendMock.mockReset();
    process.env.VIRTUAL_CARDS_TABLE = "VirtualCardsTable";
    process.env.TOKENS_TABLE = "QrTokensTable";
    process.env.DDB_ENDPOINT = "http://dynamodb-local:8000";
    process.env.AWS_REGION = "us-east-1";
    process.env.AWS_ACCESS_KEY_ID = "local";
    process.env.AWS_SECRET_ACCESS_KEY = "local";
  });

  it("returns 200 with virtualCardId + virtualQrToken + paymentMethodId", async () => {
    sendMock.mockResolvedValueOnce({}); // Put virtual card
    sendMock.mockResolvedValueOnce({}); // Put token

    const event = {
      body: JSON.stringify({ userId: "u_001", paymentMethodId: 1 }),
    };

    const res = await handler(event);
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body);
    expect(body.virtualCardId).toBeTruthy();
    expect(body.virtualQrToken).toMatch(/^vqr_/);
    expect(body.paymentMethodId).toBe("1");
  });

  it("returns 400 when missing userId", async () => {
    const event = { body: JSON.stringify({ paymentMethodId: 1 }) };
    const res = await handler(event);
    expect(res.statusCode).toBe(400);
  });
});

import { jest } from "@jest/globals";

jest.unstable_mockModule("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: jest.fn(() => ({})),
}));

const sendMock = jest.fn();

jest.unstable_mockModule("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => ({ send: sendMock })),
  },
  GetCommand: jest.fn((x) => x),
  QueryCommand: jest.fn((x) => x),
}));

const { handler } = await import("../../../src/handlers/get-virtual-qr.mjs");

describe("get-virtual-qr handler", () => {
  beforeEach(() => {
    sendMock.mockReset();
    process.env.VIRTUAL_CARDS_TABLE = "VirtualCardsTable";
    process.env.TOKENS_TABLE = "QrTokensTable";
    process.env.DDB_ENDPOINT = "http://dynamodb-local:8000";
    process.env.AWS_REGION = "us-east-1";
    process.env.AWS_ACCESS_KEY_ID = "local";
    process.env.AWS_SECRET_ACCESS_KEY = "local";
  });

  it("returns 400 when missing both userId and virtualCardId", async () => {
    const res = await handler({ queryStringParameters: {} });
    expect(res.statusCode).toBe(400);
  });

  it("returns 200 with current token when virtualCardId provided", async () => {
    // 1) Get virtual card
    sendMock.mockResolvedValueOnce({
      Item: {
        virtualCardId: "vc_123",
        userId: "u_001",
        paymentMethodId: "1",
        status: "ACTIVE",
        currentTokenId: "t_001",
      },
    });
    // 2) Get token
    sendMock.mockResolvedValueOnce({
      Item: {
        virtualCardId: "vc_123",
        tokenId: "t_001",
        tokenValue: "vqr_abc",
        status: "ACTIVE",
      },
    });

    const res = await handler({
      queryStringParameters: { userId: "u_001", virtualCardId: "vc_123" },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.virtualQrToken).toBe("vqr_abc");
    expect(body.paymentMethodId).toBe("1");
  });
});

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
  PutCommand: jest.fn((x) => x),
}));

const { handler } = await import("../../../src/handlers/issue-physical-qr.mjs");

describe("issue-physical-qr handler", () => {
  beforeEach(() => {
    sendMock.mockReset();
    process.env.VIRTUAL_CARDS_TABLE = "VirtualCardsTable";
    process.env.PHYSICAL_CARDS_TABLE = "PhysicalCardsTable";
    process.env.DDB_ENDPOINT = "http://dynamodb-local:8000";
    process.env.AWS_REGION = "us-east-1";
    process.env.AWS_ACCESS_KEY_ID = "local";
    process.env.AWS_SECRET_ACCESS_KEY = "local";
  });

  it("returns 200 with physicalQrToken + physicalQrHash", async () => {
    // Get virtual card
    sendMock.mockResolvedValueOnce({
      Item: { virtualCardId: "vc_123", userId: "u_001", status: "ACTIVE" },
    });
    // Put physical mapping
    sendMock.mockResolvedValueOnce({});

    const res = await handler({
      body: JSON.stringify({ userId: "u_001", virtualCardId: "vc_123" }),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.physicalQrToken).toMatch(/^pqr_/);
    expect(body.physicalQrHash).toMatch(/^[0-9a-f]{64}$/);
    expect(body.virtualCardId).toBe("vc_123");
  });
});

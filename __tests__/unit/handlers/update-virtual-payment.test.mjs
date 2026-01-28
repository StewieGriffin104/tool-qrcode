import { jest } from "@jest/globals";

jest.unstable_mockModule("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: jest.fn(() => ({})),
}));

const sendMock = jest.fn();

jest.unstable_mockModule("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => ({ send: sendMock })),
  },
  UpdateCommand: jest.fn((x) => x),
}));

const { handler } = await import("../../../src/handlers/update-virtual-payment.mjs");

describe("update-virtual-payment handler", () => {
  beforeEach(() => {
    sendMock.mockReset();
    process.env.VIRTUAL_CARDS_TABLE = "VirtualCardsTable";
    process.env.DDB_ENDPOINT = "http://dynamodb-local:8000";
    process.env.AWS_REGION = "us-east-1";
    process.env.AWS_ACCESS_KEY_ID = "local";
    process.env.AWS_SECRET_ACCESS_KEY = "local";
  });

  it("returns 200 updated:true", async () => {
    sendMock.mockResolvedValueOnce({}); // UpdateCommand ok

    const res = await handler({
      body: JSON.stringify({
        userId: "u_001",
        virtualCardId: "vc_123",
        paymentMethodId: 2,
      }),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.updated).toBe(true);
    expect(body.paymentMethodId).toBe("2");
  });

  it("returns 400 missing fields", async () => {
    const res = await handler({ body: JSON.stringify({}) });
    expect(res.statusCode).toBe(400);
  });
});

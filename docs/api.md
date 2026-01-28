Tokens returned by APIs are plain strings (e.g., vqr_..., pqr_...). iOS/Android should render these into QR images on-device.

Rotation is intentionally not implemented in this MVP. A single ACTIVE token is created per virtual card.



---

## 2) `docs/api.md` (API document)

# QR Token MVP API

## Overview
This MVP supports:
- Creating a **Virtual Card** (source of truth)
- Generating a **Virtual QR Token** (renderable)
- Issuing a **Physical QR Token** (fixed) bound to a Virtual Card
- Updating the **paymentMethodId** binding for a Virtual Card
- Fetching the current Virtual QR Token for display

**No rotation / pooling logic yet** (planned later). One ACTIVE virtual token is created per virtual card.

---

## Data Model (DynamoDB)

### VirtualCardsTable
- PK: `virtualCardId`
- GSI: `UserIndex` on `userId`

Fields (minimum):
- `virtualCardId` (string)
- `userId` (string)
- `paymentMethodId` (string)  // simple enum-like value, e.g., "1"=VISA, "2"=MC
- `status` = "ACTIVE"
- `currentTokenId` (string)
- `createdAt`, `updatedAt` (epoch sec)

### QrTokensTable
- PK: `virtualCardId`
- SK: `tokenId`

Fields:
- `virtualCardId` (string)
- `tokenId` (string)
- `tokenValue` (string) // QR payload, e.g., "vqr_..."
- `status` = "ACTIVE"
- `createdAt` (epoch sec)

### PhysicalCardsTable
- PK: `physicalQrHash` (sha256 hex of physicalQrToken)
- GSI: `VirtualCardIndex` on `virtualCardId`

Fields:
- `physicalQrHash` (string)
- `virtualCardId` (string)
- `userId` (string)
- `status` = "ACTIVE"
- `createdAt` (epoch sec)

---

## Token format
- Virtual QR Token: `vqr_<base64url(32 bytes)>`
- Physical QR Token: `pqr_<base64url(32 bytes)>`

These are plain ASCII strings and are directly QR-encodable by native iOS/Android QR libraries.

---

## APIs

### 1) POST createVirtualCard
Creates a new virtual card and generates its first ACTIVE virtual QR token.

**Path**
- `/virtual-card/create`

**Request**
```json
{
  "userId": "u_001",
  "paymentMethodId": 1
}

response (200)

{
  "virtualCardId": "vc_uuid",
  "virtualQrToken": "vqr_...",
  "paymentMethodId": "1"
}
```



### 2) GET getVirtualQrToken
Fetch current virtual QR token for display. (No rotation in MVP.)

**Path**
- `/virtual-card/qr`

**Query Params**
- `virtualCardId` (recommended)

- `userId` (optional; only used if virtualCardId omitted)

Example:
- `/virtual-card/qr?userId=u_001&virtualCardId=<vc_id>`

**Response(200)**
```json
{
  "virtualCardId": "vc_uuid",
  "virtualQrToken": "vqr_...",
  "paymentMethodId": "1"
}
```
**Errors**

- 400: neither userId nor virtualCardId
- 403: NOT_OWNER / VIRTUAL_CARD_BLOCKED
- 404: VIRTUAL_CARD_NOT_FOUND / TOKEN_NOT_FOUND
- 500: server error



### 3) POST issuePhysicalQrToken
Issues a physical QR token (fixed) and binds it to a virtual card.
This token is returned once and should be used for printing / physical card QR.

**Path**
- `/physical-card/issue`

**Request**
```json
{
  "userId": "u_001",
  "virtualCardId": "vc_uuid"
}

response (200)

{
  "physicalQrToken": "pqr_...",
  "physicalQrHash": "sha256hex...",
  "virtualCardId": "vc_uuid"
}

```

**Errors**

- 400: missing fields
- 403: NOT_OWNER / VIRTUAL_CARD_BLOCKED
- 404: VIRTUAL_CARD_NOT_FOUND
- 500: server error



### 4) POST issuePhysicalQrToken
Issues a physical QR token (fixed) and binds it to a virtual card.
This token is returned once and should be used for printing / physical card QR.

**Path**
- `/virtual-card/payment`

**Request**
```json
{
  "userId": "u_001",
  "virtualCardId": "vc_uuid",
  "paymentMethodId": 2
}
response (200)

{
  "virtualCardId": "vc_uuid",
  "paymentMethodId": "2",
  "updated": true
}

```

**Errors**

- 400: missing fields
- 403: NOT_OWNER / VIRTUAL_CARD_BLOCKED
- 500: server error




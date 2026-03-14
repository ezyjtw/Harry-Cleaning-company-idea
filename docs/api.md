# API Documentation

All API endpoints are located under `/api/` and return JSON responses.

## Base URL

- Development: `http://localhost:3000/api`
- Production: `https://rena.com/api`

## Authentication

Protected endpoints require an active NextAuth session. The session is managed via HTTP-only cookies set by NextAuth. Unauthenticated requests to protected endpoints receive a `401 Unauthorized` response.

## Error Response Format

All errors follow a consistent format:

```json
{
  "error": "Human-readable error message"
}
```

Common HTTP status codes:

| Code | Meaning |
|------|---------|
| `200` | Success |
| `201` | Created |
| `400` | Bad Request (validation error) |
| `401` | Unauthorized (not logged in) |
| `403` | Forbidden (insufficient permissions) |
| `404` | Not Found |
| `500` | Internal Server Error |

## Rate Limiting

API endpoints are rate-limited to prevent abuse:

- **General endpoints:** 100 requests per minute per IP
- **Authentication endpoints:** 10 requests per minute per IP
- **Booking creation:** 20 requests per minute per user

Exceeding the rate limit returns a `429 Too Many Requests` response.

---

## Endpoints

### Authentication

#### `GET/POST /api/auth/[...nextauth]`

NextAuth.js handles all authentication routes automatically.

**Key routes:**
| Path | Method | Description |
|------|--------|-------------|
| `/api/auth/signin` | `GET` | Sign-in page |
| `/api/auth/signout` | `POST` | Sign out |
| `/api/auth/session` | `GET` | Get current session |
| `/api/auth/csrf` | `GET` | Get CSRF token |
| `/api/auth/callback/credentials` | `POST` | Credentials login callback |

---

### Cleaners

#### `GET /api/cleaners`

List and search cleaners.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | `string` | Search query (searches name, location, specialties) |
| `available_now` | `"true"` | Filter to only available-now cleaners |

**Response:** `200 OK`

```json
[
  {
    "id": "1",
    "name": "Sarah Johnson",
    "photo": "/images/cleaners/sarah.jpg",
    "rating": 4.9,
    "reviewCount": 127,
    "hourlyRate": 15,
    "sameDayRate": 20,
    "bio": "Professional cleaner with 5 years experience...",
    "specialties": ["deep-clean", "end-of-tenancy"],
    "location": "Camden, London",
    "verified": true,
    "yearsExperience": 5,
    "completedJobs": 342,
    "availableNow": true,
    "tier": "GOLD",
    "availability": [
      { "day": "Monday", "start": "09:00", "end": "17:00" }
    ]
  }
]
```

---

#### `POST /api/cleaners`

Register a new cleaner (application submission).

**Auth required:** No (public registration)

**Request Body:**

```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "phone": "07123456789",
  "location": "Islington, London",
  "bio": "Experienced cleaner specialising in deep cleans...",
  "hourlyRate": 16,
  "specialties": ["regular", "deep-clean"],
  "experience": 3
}
```

**Required fields:** `name`, `email`, `phone`, `location`, `bio`, `hourlyRate`

**Response:** `201 Created`

```json
{
  "message": "Application submitted successfully",
  "cleaner": {
    "id": "1710000000000",
    "name": "Jane Smith",
    "status": "pending_review",
    "verified": false,
    "completedJobs": 0,
    "rating": 0
  }
}
```

---

#### `GET /api/cleaners/[id]`

Get a specific cleaner by ID.

**Response:** `200 OK`

```json
{
  "id": "1",
  "name": "Sarah Johnson",
  "photo": "/images/cleaners/sarah.jpg",
  "rating": 4.9,
  "reviewCount": 127,
  "hourlyRate": 15,
  "sameDayRate": 20,
  "bio": "Professional cleaner with 5 years experience...",
  "specialties": ["deep-clean", "end-of-tenancy"],
  "location": "Camden, London",
  "verified": true,
  "yearsExperience": 5,
  "completedJobs": 342,
  "availableNow": true,
  "tier": "GOLD",
  "availability": [
    { "day": "Monday", "start": "09:00", "end": "17:00" }
  ],
  "reviews": [
    {
      "id": "r1",
      "rating": 5,
      "text": "Excellent clean, very thorough!",
      "customerName": "John D.",
      "createdAt": "2024-12-01T10:00:00Z"
    }
  ]
}
```

**Error:** `404 Not Found` if cleaner does not exist.

---

### Bookings

#### `POST /api/bookings`

Create a new booking.

**Auth required:** Yes (customer)

**Request Body:**

```json
{
  "cleanerId": "1",
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "07987654321",
  "address": "123 High Street, London, SW1A 1AA",
  "date": "2025-02-15",
  "time": "10:00",
  "duration": 3,
  "serviceType": "regular",
  "notes": "Please focus on the kitchen and bathrooms",
  "totalPrice": 49.50
}
```

**Required fields:** `cleanerId`, `name`, `email`, `phone`, `address`, `date`, `time`, `duration`, `serviceType`

**Response:** `201 Created`

```json
{
  "message": "Booking created successfully",
  "booking": {
    "id": "1710000000000",
    "cleanerId": "1",
    "customerName": "John Doe",
    "date": "2025-02-15",
    "time": "10:00",
    "duration": 3,
    "serviceType": "regular",
    "status": "pending",
    "totalPrice": 49.50,
    "createdAt": "2025-02-10T14:30:00Z"
  }
}
```

---

### Estimates

#### `POST /api/estimate`

Calculate a cleaning estimate based on room details.

**Auth required:** No

**Request Body:**

```json
{
  "rooms": [
    { "type": "bedroom", "count": 2 },
    { "type": "bathroom", "count": 1 },
    { "type": "kitchen", "count": 1 },
    { "type": "living_room", "count": 1 }
  ],
  "hasPets": true,
  "extras": ["oven", "fridge"],
  "cleanerId": "1"
}
```

**Required fields:** `rooms` (array with at least one entry)

**Response:** `200 OK`

```json
{
  "estimate": {
    "recommendedDuration": 3.5,
    "recommendedServiceType": "standard",
    "roomBreakdown": [
      { "type": "bedroom", "count": 2, "minutes": 40 },
      { "type": "bathroom", "count": 1, "minutes": 30 },
      { "type": "kitchen", "count": 1, "minutes": 25 },
      { "type": "living_room", "count": 1, "minutes": 20 }
    ],
    "extrasMinutes": 40,
    "petSurchargeMinutes": 15
  },
  "priceEstimate": {
    "standard": {
      "cleanerEarnings": 52.50,
      "platformFee": 5.25,
      "total": 57.75,
      "platformFeePercent": 10
    },
    "sameDay": {
      "cleanerEarnings": 70.00,
      "platformFee": 7.00,
      "total": 77.00,
      "platformFeePercent": 10
    }
  }
}
```

If `cleanerId` is not provided or not found, `priceEstimate` will be `null`.

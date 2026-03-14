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

| Code  | Meaning                              |
| ----- | ------------------------------------ |
| `200` | Success                              |
| `201` | Created                              |
| `400` | Bad Request (validation error)       |
| `401` | Unauthorized (not logged in)         |
| `403` | Forbidden (insufficient permissions) |
| `404` | Not Found                            |
| `500` | Internal Server Error                |

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

| Parameter       | Type     | Description                                         |
| --------------- | -------- | --------------------------------------------------- |
| `q`             | `string` | Search query (searches name, location, specialties) |
| `available_now` | `"true"` | Filter to only available-now cleaners               |

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
    "availability": [{ "day": "Monday", "start": "09:00", "end": "17:00" }]
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
  "availability": [{ "day": "Monday", "start": "09:00", "end": "17:00" }],
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
  "totalPrice": 49.5
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
    "totalPrice": 49.5,
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
      "cleanerEarnings": 52.5,
      "platformFee": 5.25,
      "total": 57.75,
      "platformFeePercent": 10
    },
    "sameDay": {
      "cleanerEarnings": 70.0,
      "platformFee": 7.0,
      "total": 77.0,
      "platformFeePercent": 10
    }
  }
}
```

If `cleanerId` is not provided or not found, `priceEstimate` will be `null`.

---

### Booking Lifecycle

#### `PATCH /api/bookings/[id]/status`

Transition a booking to the next status in its lifecycle.

**Auth required:** Yes (customer, cleaner, or admin depending on transition)

**Request Body:**

```json
{
  "status": "CONFIRMED",
  "reason": "Optional reason for status change"
}
```

**Valid transitions:**
| From | To | Allowed Roles |
|------|-----|---------------|
| `PENDING` | `CONFIRMED` | Cleaner, Admin |
| `CONFIRMED` | `IN_PROGRESS` | Cleaner, Admin |
| `IN_PROGRESS` | `COMPLETED` | Cleaner, Admin |
| Any (except `COMPLETED`) | `CANCELLED` | Customer, Cleaner, Admin |

**Response:** `200 OK`

```json
{
  "booking": {
    "id": "abc123",
    "status": "CONFIRMED",
    "updatedAt": "2025-03-01T12:00:00Z"
  }
}
```

---

#### `POST /api/bookings/[id]/cancel`

Cancel a booking with refund calculation.

**Auth required:** Yes (customer or admin)

**Request Body:**

```json
{
  "reason": "Schedule conflict",
  "requestRefund": true
}
```

**Response:** `200 OK`

```json
{
  "booking": { "id": "abc123", "status": "CANCELLED" },
  "refund": {
    "eligible": true,
    "amount": 49.5,
    "type": "full",
    "reason": "Cancelled more than 48 hours before booking"
  }
}
```

---

#### `GET /api/bookings/[id]/reminders`

Get scheduled reminders for a booking.

**Auth required:** Yes (customer or cleaner on the booking)

**Response:** `200 OK`

```json
{
  "reminders": [
    { "type": "24h_before", "scheduledAt": "2025-03-14T10:00:00Z", "sent": false },
    { "type": "1h_before", "scheduledAt": "2025-03-15T09:00:00Z", "sent": false }
  ]
}
```

---

### Pricing

#### `POST /api/pricing/calculate`

Calculate the full price for a booking configuration.

**Auth required:** No

**Request Body:**

```json
{
  "cleanerId": "1",
  "serviceType": "deep-clean",
  "duration": 4,
  "date": "2025-03-15",
  "time": "10:00",
  "extras": ["oven", "fridge"],
  "discountCode": "WELCOME10"
}
```

**Response:** `200 OK`

```json
{
  "breakdown": {
    "basePrice": 60.0,
    "extras": 15.0,
    "surgeMultiplier": 1.0,
    "discount": -7.5,
    "subtotal": 67.5,
    "platformFee": 6.75,
    "total": 74.25
  }
}
```

---

#### `GET /api/pricing/surge`

Get current surge pricing information.

**Auth required:** No

**Query Parameters:**

| Parameter  | Type     | Description              |
| ---------- | -------- | ------------------------ |
| `date`     | `string` | Target date (ISO format) |
| `time`     | `string` | Target time (HH:MM)      |
| `location` | `string` | Service location         |

**Response:** `200 OK`

```json
{
  "surgeActive": true,
  "multiplier": 1.25,
  "reason": "High demand period",
  "expiresAt": "2025-03-15T18:00:00Z"
}
```

---

### Cleaner Matching

#### `POST /api/matching/find`

Find cleaners matching a booking request.

**Auth required:** Yes (customer)

**Request Body:**

```json
{
  "serviceType": "deep-clean",
  "date": "2025-03-15",
  "time": "10:00",
  "duration": 3,
  "location": "Camden, London",
  "preferences": {
    "minRating": 4.5,
    "verifiedOnly": true
  }
}
```

**Response:** `200 OK`

```json
{
  "matches": [
    {
      "cleanerId": "1",
      "name": "Sarah Johnson",
      "score": 0.95,
      "matchReasons": ["specialty_match", "high_rating", "proximity"],
      "hourlyRate": 15,
      "estimatedTotal": 49.5
    }
  ]
}
```

---

#### `POST /api/matching/auto-assign`

Automatically assign the best available cleaner to a booking.

**Auth required:** Yes (customer or admin)

**Request Body:**

```json
{
  "bookingId": "abc123"
}
```

**Response:** `200 OK`

```json
{
  "assigned": true,
  "cleaner": {
    "id": "1",
    "name": "Sarah Johnson",
    "score": 0.95
  },
  "bookingId": "abc123"
}
```

---

### Cleaner Schedule

#### `GET /api/cleaners/[id]/availability`

Get a cleaner's availability schedule.

**Auth required:** No

**Query Parameters:**

| Parameter | Type     | Description             |
| --------- | -------- | ----------------------- |
| `from`    | `string` | Start date (ISO format) |
| `to`      | `string` | End date (ISO format)   |

**Response:** `200 OK`

```json
{
  "cleanerId": "1",
  "schedule": [
    {
      "date": "2025-03-15",
      "slots": [
        { "start": "09:00", "end": "12:00", "available": true },
        { "start": "13:00", "end": "17:00", "available": false, "reason": "booked" }
      ]
    }
  ],
  "recurringAvailability": [{ "day": "Monday", "start": "09:00", "end": "17:00" }]
}
```

---

#### `PUT /api/cleaners/[id]/availability`

Update a cleaner's recurring availability.

**Auth required:** Yes (cleaner or admin)

**Request Body:**

```json
{
  "recurringAvailability": [
    { "day": "Monday", "start": "09:00", "end": "17:00" },
    { "day": "Tuesday", "start": "10:00", "end": "16:00" }
  ]
}
```

**Response:** `200 OK`

---

#### `POST /api/cleaners/[id]/availability/block`

Block out a period in a cleaner's calendar (time off, holiday, etc.).

**Auth required:** Yes (cleaner or admin)

**Request Body:**

```json
{
  "from": "2025-03-20T00:00:00Z",
  "to": "2025-03-25T23:59:59Z",
  "reason": "Holiday"
}
```

**Response:** `201 Created`

---

### Admin Operations

#### `POST /api/admin/bookings/[id]/assign`

Manually assign a cleaner to a booking.

**Auth required:** Yes (admin)

**Request Body:**

```json
{
  "cleanerId": "2",
  "reason": "Customer requested reassignment"
}
```

**Response:** `200 OK`

---

#### `POST /api/admin/bookings/[id]/reassign`

Reassign a booking to a different cleaner.

**Auth required:** Yes (admin)

**Request Body:**

```json
{
  "newCleanerId": "3",
  "reason": "Original cleaner unavailable",
  "notifyParties": true
}
```

**Response:** `200 OK`

---

#### `POST /api/admin/users/[id]/suspend`

Suspend a user account.

**Auth required:** Yes (admin)

**Request Body:**

```json
{
  "reason": "Terms of service violation",
  "duration": "30d"
}
```

**Response:** `200 OK`

---

#### `POST /api/admin/reviews/[id]/moderate`

Moderate a review (approve, reject, or flag).

**Auth required:** Yes (admin)

**Request Body:**

```json
{
  "action": "reject",
  "reason": "Contains inappropriate language"
}
```

**Response:** `200 OK`

---

### Analytics

#### `GET /api/analytics/overview`

Get platform overview analytics.

**Auth required:** Yes (admin)

**Query Parameters:**

| Parameter | Type     | Description                            |
| --------- | -------- | -------------------------------------- |
| `period`  | `string` | Time period: `7d`, `30d`, `90d`, `12m` |

**Response:** `200 OK`

```json
{
  "period": "30d",
  "totalBookings": 1250,
  "completedBookings": 1100,
  "cancelledBookings": 80,
  "totalRevenue": 62500.0,
  "platformRevenue": 6250.0,
  "activeCleaners": 85,
  "newCustomers": 210
}
```

---

#### `GET /api/analytics/revenue`

Get revenue analytics breakdown.

**Auth required:** Yes (admin)

**Response:** `200 OK`

```json
{
  "period": "30d",
  "totalRevenue": 62500.0,
  "platformFees": 6250.0,
  "averageBookingValue": 50.0,
  "revenueByServiceType": {
    "regular": 30000.0,
    "deep-clean": 18000.0,
    "end-of-tenancy": 14500.0
  },
  "dailyRevenue": [{ "date": "2025-03-01", "revenue": 2100.0 }]
}
```

---

#### `GET /api/analytics/utilization`

Get cleaner utilisation metrics.

**Auth required:** Yes (admin)

**Response:** `200 OK`

```json
{
  "averageUtilization": 0.72,
  "topCleaners": [
    { "cleanerId": "1", "name": "Sarah Johnson", "utilization": 0.92, "bookings": 45 }
  ],
  "underutilized": [{ "cleanerId": "5", "name": "Tom Wilson", "utilization": 0.3, "bookings": 8 }]
}
```

---

#### `GET /api/analytics/retention`

Get customer retention metrics.

**Auth required:** Yes (admin)

**Response:** `200 OK`

```json
{
  "period": "30d",
  "repeatCustomerRate": 0.65,
  "averageBookingsPerCustomer": 2.3,
  "churnRate": 0.08,
  "cohortRetention": {
    "month1": 0.8,
    "month3": 0.6,
    "month6": 0.45
  }
}
```

---

### AI Agent

#### `POST /api/ai/customer-assistant`

Send a message to the AI customer assistant.

**Auth required:** Yes (customer)

**Request Body:**

```json
{
  "message": "I need a deep clean for my 3-bedroom flat next Tuesday",
  "conversationId": "conv_abc123"
}
```

**Response:** `200 OK`

```json
{
  "response": "I can help you find a deep clean for next Tuesday! Based on a 3-bedroom flat, I'd estimate about 4 hours. Here are some available cleaners...",
  "intent": "booking_request",
  "entities": {
    "serviceType": "deep-clean",
    "date": "2025-03-18",
    "bedrooms": 3
  },
  "suggestedActions": [
    {
      "type": "view_cleaners",
      "label": "View available cleaners",
      "data": { "date": "2025-03-18" }
    }
  ],
  "conversationId": "conv_abc123"
}
```

---

#### `POST /api/ai/cleaner-assistant`

Send a message to the AI cleaner assistant.

**Auth required:** Yes (cleaner)

**Request Body:**

```json
{
  "message": "How are my earnings this month?",
  "conversationId": "conv_def456"
}
```

**Response:** `200 OK`

```json
{
  "response": "This month you've earned 1,850 across 38 bookings. That's 12% higher than last month. Your busiest day was last Saturday with 4 bookings.",
  "intent": "earnings_query",
  "data": {
    "earnings": 1850.0,
    "bookings": 38,
    "trend": "+12%"
  },
  "conversationId": "conv_def456"
}
```

---

#### `POST /api/ai/schedule/optimize`

Request AI-powered schedule optimisation suggestions.

**Auth required:** Yes (cleaner)

**Request Body:**

```json
{
  "cleanerId": "1",
  "dateRange": {
    "from": "2025-03-15",
    "to": "2025-03-21"
  }
}
```

**Response:** `200 OK`

```json
{
  "suggestions": [
    {
      "type": "reorder",
      "description": "Swap Tuesday 10am and 2pm bookings to reduce travel time by 25 minutes",
      "savings": { "travelMinutes": 25 }
    },
    {
      "type": "gap_fill",
      "description": "Wednesday 1-3pm is free between two nearby jobs - suggest opening this slot",
      "slot": { "date": "2025-03-19", "start": "13:00", "end": "15:00" }
    }
  ],
  "currentUtilization": 0.78,
  "optimizedUtilization": 0.85
}
```

---

### Messaging

#### `GET /api/messages/conversations`

List all conversations for the authenticated user.

**Auth required:** Yes

**Query Parameters:**

| Parameter | Type     | Description                    |
| --------- | -------- | ------------------------------ |
| `page`    | `number` | Page number (default: 1)       |
| `limit`   | `number` | Results per page (default: 20) |

**Response:** `200 OK`

```json
{
  "conversations": [
    {
      "id": "conv_1",
      "participant": { "id": "2", "name": "Sarah Johnson", "photo": "/images/cleaners/sarah.jpg" },
      "lastMessage": {
        "text": "See you tomorrow at 10am!",
        "sentAt": "2025-03-14T15:30:00Z",
        "read": true
      },
      "unreadCount": 0
    }
  ],
  "pagination": { "page": 1, "totalPages": 3, "total": 45 }
}
```

---

#### `GET /api/messages/conversations/[id]`

Get message history for a conversation.

**Auth required:** Yes (participant in the conversation)

**Query Parameters:**

| Parameter | Type     | Description                     |
| --------- | -------- | ------------------------------- |
| `page`    | `number` | Page number (default: 1)        |
| `limit`   | `number` | Messages per page (default: 50) |

**Response:** `200 OK`

```json
{
  "conversationId": "conv_1",
  "messages": [
    {
      "id": "msg_1",
      "senderId": "1",
      "text": "Hi, I'd like to confirm the booking for tomorrow.",
      "sentAt": "2025-03-14T15:00:00Z",
      "read": true,
      "attachments": []
    }
  ],
  "pagination": { "page": 1, "totalPages": 1, "total": 12 }
}
```

---

#### `POST /api/messages/conversations/[id]/send`

Send a message in a conversation.

**Auth required:** Yes (participant in the conversation)

**Request Body:**

```json
{
  "text": "Looking forward to it!",
  "attachments": []
}
```

**Response:** `201 Created`

```json
{
  "message": {
    "id": "msg_13",
    "senderId": "2",
    "text": "Looking forward to it!",
    "sentAt": "2025-03-14T15:35:00Z",
    "read": false
  }
}
```

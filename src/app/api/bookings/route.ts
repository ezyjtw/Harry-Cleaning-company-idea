import { NextRequest, NextResponse } from "next/server";
import { getCleanerById } from "@/lib/mock-data";

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Validate required fields
  const required = [
    "cleanerId",
    "name",
    "email",
    "phone",
    "address",
    "date",
    "time",
    "duration",
    "serviceType",
  ];
  for (const field of required) {
    if (!body[field]) {
      return NextResponse.json(
        { error: `${field} is required` },
        { status: 400 }
      );
    }
  }

  // Verify cleaner exists
  const cleaner = getCleanerById(body.cleanerId);
  if (!cleaner) {
    return NextResponse.json({ error: "Cleaner not found" }, { status: 404 });
  }

  // In production, this would save to a database and send notifications
  const booking = {
    id: String(Date.now()),
    cleanerId: body.cleanerId,
    customerName: body.name,
    customerEmail: body.email,
    customerPhone: body.phone,
    address: body.address,
    date: body.date,
    time: body.time,
    duration: body.duration,
    serviceType: body.serviceType,
    notes: body.notes || "",
    status: "pending",
    totalPrice: body.totalPrice,
    createdAt: new Date().toISOString(),
  };

  return NextResponse.json(
    { message: "Booking created successfully", booking },
    { status: 201 }
  );
}

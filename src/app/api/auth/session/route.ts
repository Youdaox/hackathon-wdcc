import { NextResponse } from "next/server";
import { sessionFromRequest } from "@/lib/auth";

export async function GET(request: Request) {
  return NextResponse.json({ user: sessionFromRequest(request) });
}

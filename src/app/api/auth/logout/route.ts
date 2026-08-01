import { NextResponse } from "next/server";
import { clearSessionCookie, deleteSessionFromRequest } from "@/lib/auth";

export async function POST(request: Request) {
  deleteSessionFromRequest(request);
  return NextResponse.json({ ok: true }, { headers: { "Set-Cookie": clearSessionCookie() } });
}

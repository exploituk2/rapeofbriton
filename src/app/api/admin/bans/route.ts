import { NextResponse } from "next/server";
import { addBan, listBans, removeBan } from "@/lib/ingest-security";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function assertAdmin(request: Request) {
  const secret = process.env.INGEST_ADMIN_SECRET?.trim();
  if (!secret) {
    throw new Error(
      "INGEST_ADMIN_SECRET is not set. Add it in Vercel env vars to manage bans.",
    );
  }
  const header = request.headers.get("x-admin-secret")?.trim();
  if (!header || header !== secret) {
    return false;
  }
  return true;
}

export async function GET(request: Request) {
  try {
    if (!assertAdmin(request)) return unauthorized();
    const bans = await listBans();
    return NextResponse.json(bans);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!assertAdmin(request)) return unauthorized();
    const body = (await request.json()) as {
      banType?: "url" | "domain" | "prefix";
      value?: string;
      reason?: string;
    };

    if (!body.banType || !body.value?.trim()) {
      return NextResponse.json(
        { error: "banType and value are required" },
        { status: 400 },
      );
    }

    if (!["url", "domain", "prefix"].includes(body.banType)) {
      return NextResponse.json({ error: "invalid banType" }, { status: 400 });
    }

    const ban = await addBan({
      banType: body.banType,
      value: body.value,
      reason: body.reason,
    });
    return NextResponse.json(ban, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    if (!assertAdmin(request)) return unauthorized();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    await removeBan(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

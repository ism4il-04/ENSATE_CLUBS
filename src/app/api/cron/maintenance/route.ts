import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { maintenance } from "@/server/services/maintenance";

export const dynamic = "force-dynamic";

/** Vercel Cron appelle cette route avec « Authorization: Bearer $CRON_SECRET » (comparaison à temps constant). */
function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(req.headers.get("authorization") ?? "");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ erreur: "NON_AUTORISE" }, { status: 401 });
  const result = await maintenance();
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

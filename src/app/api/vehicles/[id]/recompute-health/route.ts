import { NextRequest, NextResponse } from "next/server";
import { recomputeVehicleHealth } from "@/lib/health/compute";

/**
 * POST /api/vehicles/:id/recompute-health
 * Appelé après chaque observation validée (voir ObservationForm). Le score
 * de santé n'est jamais saisi manuellement — toujours dérivé des
 * observations (cahier des charges §6-§7).
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await recomputeVehicleHealth(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/server/auth/context";
import { parseInput, runAction } from "./result";
import { upsertDepartment, upsertLocation, upsertPosition } from "@/server/services/org.service";
import { departmentSchema, locationSchema, positionSchema } from "@/lib/validation/org";
import type { ActionResult } from "@/lib/action-result";
import { serverT } from "@/server/i18n";

export async function saveDepartmentAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    await upsertDepartment(ctx, parseInput(departmentSchema, formData));
    revalidatePath("/organization/departments");
    revalidatePath("/org-chart");
  }, (await serverT("organization"))("departments.saved"));
}

export async function savePositionAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    await upsertPosition(ctx, parseInput(positionSchema, formData));
    revalidatePath("/organization/positions");
  }, (await serverT("organization"))("positions.saved"));
}

export async function saveLocationAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    await upsertLocation(ctx, parseInput(locationSchema, formData));
    revalidatePath("/organization/locations");
  }, (await serverT("organization"))("locations.saved"));
}

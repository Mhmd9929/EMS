"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/server/auth/context";
import { parseInput, runAction } from "./result";
import { upsertDepartment, upsertLocation, upsertPosition } from "@/server/services/org.service";
import { departmentSchema, locationSchema, positionSchema } from "@/lib/validation/org";
import type { ActionResult } from "@/lib/action-result";

export async function saveDepartmentAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    await upsertDepartment(ctx, parseInput(departmentSchema, formData));
    revalidatePath("/organization/departments");
    revalidatePath("/org-chart");
  }, "Department saved.");
}

export async function savePositionAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    await upsertPosition(ctx, parseInput(positionSchema, formData));
    revalidatePath("/organization/positions");
  }, "Position saved.");
}

export async function saveLocationAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    await upsertLocation(ctx, parseInput(locationSchema, formData));
    revalidatePath("/organization/locations");
  }, "Location saved.");
}

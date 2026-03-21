import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { StaffAuthError, getRequiredStaffSession } from '@/server/modules/staff-auth/service';
import { menuRepository } from '@/server/modules/menu/repository';
import {
  createBaseMenuItem,
  MenuConflictError,
  MenuValidationError,
} from '@/server/modules/menu/service';

const createMenuItemSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Code must be lowercase kebab-case.'),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(300).optional(),
});

export async function POST(request: NextRequest) {
  try {
    await getRequiredStaffSession(request);
  } catch (error) {
    if (error instanceof StaffAuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 });
  }

  const body = createMenuItemSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  try {
    const item = await createBaseMenuItem(menuRepository, body.data);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    if (error instanceof MenuValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof MenuConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 });
  }
}

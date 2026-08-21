/**
 * Zod schemas for the user forms. Mirrors the backend contract: role is
 * ADMIN or MEMBER; the create form additionally takes an initial `password`
 * (min 8). The update form carries no email or password (identity /
 * credentials are not editable here).
 */
import { z } from "zod";
import { USER_ROLES } from "@/types";

export const userCreateSchema = z.object({
  name: z.string().trim().min(2, "Name is required."),
  email: z.string().trim().email("Enter a valid email address."),
  role: z.enum(USER_ROLES),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

/** Create-form values inferred from the schema. */
export type UserCreateValues = z.infer<typeof userCreateSchema>;

export const userUpdateSchema = z.object({
  name: z.string().trim().min(2, "Name is required."),
  role: z.enum(USER_ROLES),
  isActive: z.boolean(),
});

/** Update-form values inferred from the schema. */
export type UserUpdateValues = z.infer<typeof userUpdateSchema>;

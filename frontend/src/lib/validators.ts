import { z } from "zod";

/**
 * Client-side validation schemas. These mirror the Laravel FormRequest rules so
 * users get instant feedback; the server remains the source of truth.
 */

export const loginSchema = z.object({
  file_number: z.string().min(1, "File number is required"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, "Current password is required"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    password_confirmation: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.password_confirmation, {
    message: "Passwords do not match",
    path: ["password_confirmation"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const studentLoginSchema = z.object({
  matric_number: z.string().min(1, "Matric number is required"),
  exam_code: z.string().min(1, "Exam code is required"),
});

export type StudentLoginInput = z.infer<typeof studentLoginSchema>;

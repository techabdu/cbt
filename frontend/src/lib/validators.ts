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
    current_password:          z.string().min(1, "Current password is required"),
    new_password:              z.string().min(8, "Password must be at least 8 characters"),
    new_password_confirmation: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.new_password === data.new_password_confirmation, {
    message: "Passwords do not match",
    path: ["new_password_confirmation"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const collegeSchema = z.object({
  name: z.string().min(1, "College name is required").max(255),
  contact_email: z.string().email("Enter a valid email").max(255).or(z.literal("")),
  contact_phone: z.string().max(30).or(z.literal("")),
  address: z.string().max(1000).or(z.literal("")),
});

export type CollegeInput = z.infer<typeof collegeSchema>;

export const schoolSchema = z.object({
  name: z.string().min(1, "School name is required").max(255),
  code: z.string().min(1, "Code is required").max(20),
  head_name: z.string().max(255).or(z.literal("")),
});

export type SchoolInput = z.infer<typeof schoolSchema>;

export const cbtAdminSchema = z.object({
  file_number: z.string().min(1, "File number is required").max(50),
  name: z.string().min(1, "Name is required").max(255),
  email: z.string().email("Enter a valid email").max(255).or(z.literal("")),
});

export type CbtAdminInput = z.infer<typeof cbtAdminSchema>;

export const studentLoginSchema = z.object({
  matric_number: z.string().min(1, "Matric number is required"),
  exam_code: z.string().min(1, "Exam code is required"),
});

export type StudentLoginInput = z.infer<typeof studentLoginSchema>;

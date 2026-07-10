import { z } from "zod";

export const leadIntentSchema = z.enum(["viewing", "rental", "investment"]);

export const leadCaptureSchema = z
  .object({
    contactName: z.string().trim().min(2, "Add your name."),
    contactEmail: z.union([z.email("Enter a valid email."), z.literal("")]),
    contactPhone: z.string().trim(),
    intent: leadIntentSchema,
    message: z.string().trim()
  })
  .refine((value) => Boolean(value.contactEmail || value.contactPhone), {
    message: "Add at least one contact method.",
    path: ["contactEmail"]
  });

export type LeadCaptureFormValues = z.infer<typeof leadCaptureSchema>;
export type LeadIntent = z.infer<typeof leadIntentSchema>;

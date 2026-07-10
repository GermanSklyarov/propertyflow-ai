import { z } from "zod";

export const conciergeRequestSchema = z.object({
  message: z.string().trim().min(12, "Describe your move, budget, or investment target.")
});

export type ConciergeRequestFormValues = z.infer<typeof conciergeRequestSchema>;

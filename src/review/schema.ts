import { z } from "zod";

export const FindingSchema = z.object({
  file: z.string(),
  line: z.number().int().positive().nullable(), // null = file-level
  severity: z.enum(["info", "warning", "error"]),
  category: z.enum(["bug", "security", "performance", "style", "test", "docs", "other"]),
  title: z.string().max(120),
  message: z.string(),
  suggestion: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

export const ChunkReviewSchema = z.object({
  summary: z.string(),
  findings: z.array(FindingSchema),
});

export type Finding = z.infer<typeof FindingSchema>;
export type ChunkReview = z.infer<typeof ChunkReviewSchema>;

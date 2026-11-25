import * as core from "@actions/core";
import { ChunkReview, ChunkReviewSchema } from "./schema.js";

export function parseReviewResponse(rawResponse: string, fallbackFile = "unknown"): ChunkReview {
  try {
    // Strip possible markdown code block fences ```json ... ```
    let cleanJson = rawResponse.trim();
    if (cleanJson.startsWith("```json")) {
      cleanJson = cleanJson.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (cleanJson.startsWith("```")) {
      cleanJson = cleanJson.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    const parsed = JSON.parse(cleanJson);
    const validated = ChunkReviewSchema.safeParse(parsed);

    if (validated.success) {
      return validated.data;
    } else {
      core.warning(
        `Review JSON validation failed schema check: ${validated.error.message}. Falling back to markdown parsing.`
      );
    }
  } catch (err: any) {
    core.warning(`Failed to parse review response as JSON: ${err.message}. Falling back to markdown.`);
  }

  // Fallback markdown mode: Never crash
  return {
    summary: rawResponse.slice(0, 1000) || "Review completed (unstructured output).",
    findings: [
      {
        file: fallbackFile,
        line: null,
        severity: "info",
        category: "other",
        title: "Model Output (Unstructured)",
        message: rawResponse,
        suggestion: null,
        confidence: 0.5,
      },
    ],
  };
}

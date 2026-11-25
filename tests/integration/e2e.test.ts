import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import * as core from "@actions/core";
import * as github from "@actions/github";
import { run } from "../../src/index.js";

// Sample diff with 3 files: src/file1.ts, src/file2.ts, src/file3.ts
const THREE_FILE_DIFF = `
diff --git a/src/file1.ts b/src/file1.ts
new file mode 100644
index 0000000..1111111
--- /dev/null
+++ b/src/file1.ts
@@ -0,0 +1,5 @@
+export function file1() {
+  return "file1";
+}
diff --git a/src/file2.ts b/src/file2.ts
new file mode 100644
index 0000000..2222222
--- /dev/null
+++ b/src/file2.ts
@@ -0,0 +1,5 @@
+export function file2() {
+  return "file2";
+}
diff --git a/src/file3.ts b/src/file3.ts
new file mode 100644
index 0000000..3333333
--- /dev/null
+++ b/src/file3.ts
@@ -0,0 +1,5 @@
+export function file3() {
+  return "file3";
+}
+`;

describe("End-to-End Integration Scenarios (MSW Mocked)", () => {
  let createdComments: any[] = [];
  let updatedComments: any[] = [];
  let createdReviews: any[] = [];
  let addedLabels: any[] = [];
  let outputs: Record<string, any> = {};
  let setFailedMessages: string[] = [];

  const server = setupServer(
    // 1. GitHub Get Diff
    http.get("https://api.github.com/repos/owner/repo/pulls/10", () => {
      return new HttpResponse(THREE_FILE_DIFF, {
        headers: { "Content-Type": "application/vnd.github.v3.diff" },
      });
    }),

    // 2. GitHub List Comments
    http.get("https://api.github.com/repos/owner/repo/issues/10/comments", () => {
      return HttpResponse.json(createdComments);
    }),

    // 3. GitHub Create Comment
    http.post("https://api.github.com/repos/owner/repo/issues/10/comments", async ({ request }) => {
      const body = await request.json();
      const newComment = { id: createdComments.length + 1, body, html_url: `https://github.com/comment/${createdComments.length + 1}` };
      createdComments.push(newComment);
      return HttpResponse.json(newComment);
    }),

    // 4. GitHub Update Comment
    http.patch("https://api.github.com/repos/owner/repo/issues/comments/:id", async ({ request, params }) => {
      const body = await request.json();
      const updated = { id: params.id, body, html_url: `https://github.com/comment/${params.id}` };
      updatedComments.push(updated);
      return HttpResponse.json(updated);
    }),

    // 5. GitHub Create Review
    http.post("https://api.github.com/repos/owner/repo/pulls/10/reviews", async ({ request }) => {
      const body = await request.json();
      createdReviews.push(body);
      return HttpResponse.json({ id: 101, html_url: "https://github.com/review/101" });
    }),

    // 6. GitHub Get Issue (for labels)
    http.get("https://api.github.com/repos/owner/repo/issues/10", () => {
      return HttpResponse.json({ labels: [] });
    }),

    // 7. GitHub Add Labels
    http.post("https://api.github.com/repos/owner/repo/issues/10/labels", async ({ request }) => {
      const body = await request.json();
      addedLabels.push(body);
      return HttpResponse.json(body);
    }),

    // 8. BharatCode Chat Completions
    http.post("https://api.bharatcode.ai/v1/chat/completions", async () => {
      return HttpResponse.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: "Review for chunk completed.",
                findings: [
                  {
                    file: "src/file1.ts",
                    line: 2,
                    severity: "error",
                    category: "bug",
                    title: "Bug in file1",
                    message: "Fix logic",
                    suggestion: "return null;",
                    confidence: 0.9,
                  },
                  {
                    file: "src/file2.ts",
                    line: 2,
                    severity: "warning",
                    category: "performance",
                    title: "Perf in file2",
                    message: "Optimize logic",
                    suggestion: null,
                    confidence: 0.85,
                  },
                ],
              }),
            },
          },
        ],
        usage: { prompt_tokens: 150, completion_tokens: 80 },
      });
    })
  );

  beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
  afterAll(() => server.close());

  beforeEach(() => {
    server.resetHandlers();
    createdComments = [];
    updatedComments = [];
    createdReviews = [];
    addedLabels = [];
    outputs = {};
    setFailedMessages = [];

    vi.spyOn(core, "setOutput").mockImplementation((name, val) => {
      outputs[name] = val;
    });
    vi.spyOn(core, "setFailed").mockImplementation((msg: string | Error) => {
      setFailedMessages.push(typeof msg === "string" ? msg : msg.message);
    });

    // Default mock inputs
    vi.spyOn(core, "getInput").mockImplementation((name) => {
      switch (name) {
        case "bharatcode-api-key":
          return "test-bc-key";
        case "github-token":
          return "gh-test-token";
        case "bharatcode-base-url":
          return "https://api.bharatcode.ai/v1";
        case "model":
          return "deepseek-v4.1-flash";
        case "chunk-strategy":
          return "file";
        case "mode":
          return "summary+inline";
        case "severity-threshold":
          return "info";
        case "fail-on-severity":
          return "none";
        default:
          return "";
      }
    });

    vi.spyOn(core, "getBooleanInput").mockImplementation((name) => {
      if (name === "post-labels") return true;
      if (name === "dry-run") return false;
      if (name === "cache-enabled") return false; // disable caching for clean integration tests
      if (name === "allow-forks") return false;
      return false;
    });

    // Mock github context via Object.defineProperty
    Object.defineProperty(github, "context", {
      value: {
        payload: {
          pull_request: {
            number: 10,
            head: { sha: "head123456", repo: { full_name: "owner/repo" } },
            base: { repo: { full_name: "owner/repo" } },
          },
        },
        repo: { owner: "owner", repo: "repo" },
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Scenario 1: Happy path: 3 files, 2 findings -> 1 summary comment + 1 inline review with 2 comments
  it("Scenario 1: Happy path with 3 files and findings", async () => {
    await run();

    expect(createdComments.length).toBe(1);
    expect(createdReviews.length).toBe(1);
    expect(createdReviews[0].comments.length).toBe(2);
    expect(outputs["findings-count"]).toBe(2);
    expect(outputs["error-count"]).toBe(1);
    expect(setFailedMessages.length).toBe(0);
  });

  // Scenario 2: Update path: same PR run twice -> comment updated, not duplicated
  it("Scenario 2: Update path: existing comment is updated, not duplicated", async () => {
    // Pre-populate an existing comment with the marker
    createdComments.push({
      id: 55,
      body: "<!-- bharatcode-review-action --> Old summary",
    });

    await run();

    expect(createdComments.length).toBe(1); // not added
    expect(updatedComments.length).toBe(1); // updated
    expect(updatedComments[0].id).toBe("55");
  });

  // Scenario 3: API 500 twice then 200 -> succeeds via retry
  it("Scenario 3: API 500 twice then 200 succeeds via retry", async () => {
    let attempts = 0;
    server.use(
      http.post("https://api.bharatcode.ai/v1/chat/completions", () => {
        attempts++;
        if (attempts <= 2) {
          return new HttpResponse("Server Error", { status: 500 });
        }
        return HttpResponse.json({
          choices: [{ message: { content: JSON.stringify({ summary: "Recovered", findings: [] }) } }],
          usage: { prompt_tokens: 50, completion_tokens: 20 },
        });
      })
    );

    await run();

    expect(attempts).toBeGreaterThanOrEqual(3);
    expect(setFailedMessages.length).toBe(0);
  });

  // Scenario 4: API 500 x 4 -> fails with clear message
  it("Scenario 4: API 500 x 4 fails with clear message", async () => {
    server.use(
      http.post("https://api.bharatcode.ai/v1/chat/completions", () => {
        return new HttpResponse("Permanent 500 Error", { status: 500 });
      })
    );

    vi.spyOn(core, "getInput").mockImplementation((name) => {
      if (name === "max-retries") return "2";
      if (name === "bharatcode-api-key") return "test-bc-key";
      if (name === "github-token") return "gh-test-token";
      return "";
    });

    await run();

    expect(setFailedMessages.length).toBeGreaterThan(0);
    expect(setFailedMessages[0]).toContain("BharatCode Action Error");
  });

  // Scenario 5: Fork PR -> skipped
  it("Scenario 5: Fork PR with allow-forks false is skipped", async () => {
    (github as any).context.payload.pull_request.head.repo.full_name = "contributor/repo";

    await run();

    expect(createdComments.length).toBe(0);
    expect(createdReviews.length).toBe(0);
    expect(setFailedMessages.length).toBe(0);
  });

  // Scenario 6: dry-run: true -> zero write API calls
  it("Scenario 6: dry-run true performs zero write API calls", async () => {
    vi.spyOn(core, "getBooleanInput").mockImplementation((name) => {
      if (name === "dry-run") return true;
      return false;
    });

    await run();

    expect(createdComments.length).toBe(0);
    expect(createdReviews.length).toBe(0);
    expect(addedLabels.length).toBe(0);
  });

  // Scenario 7: Budget exceeded -> partial results, est-usd output set
  it("Scenario 7: Budget exceeded aborts further chunks and sets est-usd", async () => {
    vi.spyOn(core, "getInput").mockImplementation((name) => {
      if (name === "max-usd-budget") return "0.000000001"; // Tiny budget
      if (name === "bharatcode-api-key") return "test-bc-key";
      if (name === "github-token") return "gh-test-token";
      return "";
    });

    await run();

    expect(outputs["est-usd"]).toBeDefined();
    expect(parseFloat(outputs["est-usd"])).toBeGreaterThanOrEqual(0);
  });

  // Scenario 8: Coverage and mode tests
  it("Scenario 8: Gate mode creates check run", async () => {
    let checkRunCreated = false;
    server.use(
      http.post("https://api.github.com/repos/owner/repo/check-runs", () => {
        checkRunCreated = true;
        return HttpResponse.json({ id: 1 });
      })
    );

    vi.spyOn(core, "getInput").mockImplementation((name) => {
      if (name === "mode") return "gate";
      if (name === "bharatcode-api-key") return "test-bc-key";
      if (name === "github-token") return "gh-test-token";
      return "";
    });

    await run();

    expect(checkRunCreated).toBe(true);
  });
});

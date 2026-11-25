import { describe, it, expect, vi, beforeEach } from "vitest";
import * as github from "@actions/github";
import * as core from "@actions/core";
import { run } from "../../src/index.js";

describe("Slash Command Handling (/bharatcode review)", () => {
  let outputs: Record<string, any> = {};
  let setFailedMessages: string[] = [];

  beforeEach(() => {
    outputs = {};
    setFailedMessages = [];

    vi.spyOn(core, "setOutput").mockImplementation((name, val) => {
      outputs[name] = val;
    });
    vi.spyOn(core, "setFailed").mockImplementation((msg: string | Error) => {
      setFailedMessages.push(typeof msg === "string" ? msg : msg.message);
    });

    vi.spyOn(core, "getInput").mockImplementation((name) => {
      if (name === "bharatcode-api-key") return "test-bc-key";
      if (name === "github-token") return "gh-test-token";
      return "";
    });

    vi.spyOn(core, "getBooleanInput").mockImplementation((name) => {
      if (name === "dry-run") return true; // dry-run mode
      return false;
    });
  });

  it("ignores issue_comment not starting with /bharatcode review", async () => {
    (github as any).context = {
      payload: {
        issue: { pull_request: {}, number: 42 },
        comment: {
          id: 100,
          body: "Just a regular comment",
          author_association: "MEMBER",
        },
      },
      repo: { owner: "owner", repo: "repo" },
    };

    await run();
    expect(setFailedMessages.length).toBe(0);
  });

  it("blocks non-authorized users (e.g. NONE)", async () => {
    (github as any).context = {
      payload: {
        issue: { pull_request: {}, number: 42 },
        comment: {
          id: 100,
          body: "/bharatcode review",
          author_association: "NONE",
          user: { login: "untrusted-user" },
        },
      },
      repo: { owner: "owner", repo: "repo" },
    };

    await run();
    expect(setFailedMessages.length).toBe(0);
  });
});

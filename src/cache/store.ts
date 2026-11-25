import crypto from "crypto";
import fs from "fs";
import path from "path";
import * as core from "@actions/core";
import { Finding } from "../types.js";

export interface CachePayload {
  commitSha: string;
  model: string;
  promptVersion: string;
  summary: string;
  findings: Finding[];
  timestamp: number;
}

export class CacheStore {
  private cacheDir: string;

  constructor(cacheDir = ".bharatcode-review-cache") {
    this.cacheDir = path.resolve(process.cwd(), cacheDir);
  }

  public getCacheKey(commitSha: string, model: string, promptVersion: string): string {
    return crypto
      .createHash("sha256")
      .update(`${commitSha}:${model}:${promptVersion}`)
      .digest("hex");
  }

  public async get(
    commitSha: string,
    model: string,
    promptVersion: string
  ): Promise<CachePayload | null> {
    try {
      const key = this.getCacheKey(commitSha, model, promptVersion);
      const filePath = path.join(this.cacheDir, `${key}.json`);

      if (!fs.existsSync(filePath)) {
        return null;
      }

      const content = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(content) as CachePayload;
      core.info(`[Cache] Cache HIT for key ${key} (SHA: ${commitSha})`);
      return data;
    } catch (err: any) {
      core.debug(`[Cache] Cache read error: ${err.message}`);
      return null;
    }
  }

  public async set(
    commitSha: string,
    model: string,
    promptVersion: string,
    summary: string,
    findings: Finding[]
  ): Promise<void> {
    try {
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      }

      const key = this.getCacheKey(commitSha, model, promptVersion);
      const filePath = path.join(this.cacheDir, `${key}.json`);

      const payload: CachePayload = {
        commitSha,
        model,
        promptVersion,
        summary,
        findings,
        timestamp: Date.now(),
      };

      fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf-8");
      core.debug(`[Cache] Cached review results to ${filePath}`);
    } catch (err: any) {
      core.warning(`[Cache] Failed to write cache: ${err.message}`);
    }
  }
}

import * as core from "@actions/core";

export interface TelemetrySpan {
  name: string;
  startTime: number;
  attributes: Record<string, string | number | boolean>;
}

export class Telemetry {
  private static instance: Telemetry;
  private otlpEndpoint: string | null = null;
  private spans: TelemetrySpan[] = [];

  private constructor() {
    this.otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || null;
  }

  public static getInstance(): Telemetry {
    if (!Telemetry.instance) {
      Telemetry.instance = new Telemetry();
    }
    return Telemetry.instance;
  }

  public startSpan(name: string, attributes: Record<string, string | number | boolean> = {}): TelemetrySpan {
    const span: TelemetrySpan = {
      name,
      startTime: Date.now(),
      attributes,
    };
    this.spans.push(span);
    core.debug(`[Telemetry] Started span '${name}': ${JSON.stringify(attributes)}`);
    return span;
  }

  public endSpan(span: TelemetrySpan, extraAttributes: Record<string, string | number | boolean> = {}): void {
    const duration = Date.now() - span.startTime;
    span.attributes = { ...span.attributes, ...extraAttributes, durationMs: duration };
    core.debug(`[Telemetry] Ended span '${span.name}' in ${duration}ms`);
  }

  public logEvent(event: string, properties: Record<string, unknown> = {}): void {
    core.info(`[Telemetry Event] ${event}: ${JSON.stringify(properties)}`);
  }

  public async flush(): Promise<void> {
    if (!this.otlpEndpoint || this.spans.length === 0) {
      return;
    }
    try {
      core.debug(`[Telemetry] Flushing ${this.spans.length} spans to OTLP endpoint: ${this.otlpEndpoint}`);
      const payload = {
        resourceSpans: [
          {
            scopeSpans: [
              {
                spans: this.spans.map((s) => ({
                  name: s.name,
                  attributes: Object.entries(s.attributes).map(([key, value]) => ({
                    key,
                    value: { stringValue: String(value) },
                  })),
                  durationMs: s.attributes.durationMs,
                })),
              },
            ],
          },
        ],
      };
      await fetch(this.otlpEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(3000),
      }).catch((err) => {
        core.debug(`[Telemetry] OTLP export failed: ${err.message}`);
      });
    } catch (e: any) {
      core.debug(`[Telemetry] Flush error: ${e.message}`);
    }
  }
}

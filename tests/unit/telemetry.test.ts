import { describe, it, expect, vi } from "vitest";
import { Telemetry } from "../../src/telemetry.js";

describe("Telemetry (telemetry.ts)", () => {
  it("tracks spans, logs events and flushes OTLP when endpoint configured", async () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "https://otlp.example.com/v1/traces";
    const telemetry = Telemetry.getInstance();

    const span = telemetry.startSpan("unit_test_span", { test: true });
    telemetry.logEvent("test_event", { foo: "bar" });
    telemetry.endSpan(span, { extra: 123 });

    expect(span.attributes.durationMs).toBeDefined();

    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch;

    await telemetry.flush();
    expect(mockFetch).toHaveBeenCalled();

    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  });
});

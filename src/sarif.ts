import { Finding } from "./types.js";

export interface SarifPhysicalLocation {
  artifactLocation: {
    uri: string;
  };
  region?: {
    startLine: number;
    startColumn?: number;
  };
}

export interface SarifResult {
  ruleId: string;
  level: "none" | "note" | "warning" | "error";
  message: {
    text: string;
  };
  locations: {
    physicalLocation: SarifPhysicalLocation;
  }[];
}

export interface SarifReport {
  version: "2.1.0";
  $schema: string;
  runs: {
    tool: {
      driver: {
        name: string;
        version: string;
        informationUri?: string;
        rules?: {
          id: string;
          shortDescription?: { text: string };
          fullDescription?: { text: string };
        }[];
      };
    };
    results: SarifResult[];
  }[];
}

export function convertFindingsToSarif(findings: Finding[]): SarifReport {
  const rulesMap = new Map<string, string>();

  const results: SarifResult[] = findings.map((f) => {
    const ruleId = `BC-${f.category.toUpperCase()}`;
    if (!rulesMap.has(ruleId)) {
      rulesMap.set(ruleId, f.title);
    }

    // SARIF levels: "error", "warning", "note" (for info)
    const level: SarifResult["level"] =
      f.severity === "error" ? "error" : f.severity === "warning" ? "warning" : "note";

    const physicalLocation: SarifPhysicalLocation = {
      artifactLocation: {
        uri: f.file,
      },
    };

    if (f.line && f.line > 0) {
      physicalLocation.region = {
        startLine: f.line,
        startColumn: 1,
      };
    }

    return {
      ruleId,
      level,
      message: {
        text: `${f.title}: ${f.message}`,
      },
      locations: [
        {
          physicalLocation,
        },
      ],
    };
  });

  const rules = Array.from(rulesMap.entries()).map(([id, title]) => ({
    id,
    shortDescription: { text: title },
    fullDescription: { text: `BharatCode automated rule check for ${id}` },
  }));

  return {
    version: "2.1.0",
    $schema: "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
    runs: [
      {
        tool: {
          driver: {
            name: "BharatCode PR Reviewer",
            version: "1.0.0",
            informationUri: "https://bharatcode.ai",
            rules,
          },
        },
        results,
      },
    ],
  };
}

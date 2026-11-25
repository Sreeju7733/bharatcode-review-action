export class BharatCodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BharatCodeError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ConfigError extends BharatCodeError {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export class UpstreamError extends BharatCodeError {
  public readonly status?: number;
  public readonly body?: string;
  public readonly retryable: boolean;

  constructor(message: string, status?: number, body?: string, retryable = true) {
    super(message);
    this.name = "UpstreamError";
    this.status = status;
    this.body = body;
    this.retryable = retryable;
  }
}

export class BudgetExceededError extends BharatCodeError {
  public readonly currentSpend: number;
  public readonly maxBudget: number;

  constructor(currentSpend: number, maxBudget: number) {
    super(`USD budget exceeded: current spend $${currentSpend.toFixed(4)} >= budget $${maxBudget.toFixed(4)}`);
    this.name = "BudgetExceededError";
    this.currentSpend = currentSpend;
    this.maxBudget = maxBudget;
  }
}

export class GitHubApiError extends BharatCodeError {
  public readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "GitHubApiError";
    this.status = status;
  }
}

export class DiffParseError extends BharatCodeError {
  constructor(message: string) {
    super(message);
    this.name = "DiffParseError";
  }
}

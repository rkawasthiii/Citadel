// Veritus API types based on the API documentation
// Rate limit: 10 requests per minute (see veritusApidocs.md)

export interface VeritusPaper {
  abstract: string | null;
  authors: string;
  doi: string | null;
  downloadable: boolean;
  engine?: string;
  fieldsOfStudy: string[];
  id: string;
  impactFactor: {
    citationCount: number;
    influentialCitationCount: number;
    referenceCount: number;
  };
  isOpenAccess?: boolean;
  isPrePrint?: boolean;
  journalName: string | null;
  link?: string;
  pdfLink?: string;
  publicationType: string | null;
  publishedAt: string | null;
  score: number | null;
  semanticLink?: string;
  title: string;
  titleLink?: string;
  tldr: string | null;
  v_country: string | null;
  v_journal_name: string | null;
  v_publisher: string | null;
  v_quartile_ranking: string | null;
  year: number | null;
}

export interface CreateJobRequest {
  phrases?: string[];
  query?: string;
  callbackUrl?: string;
  enrich?: boolean;
}

export interface CreateJobResponse {
  jobId: string;
}

export interface JobStatusResponse {
  status: "queued" | "success" | "error";
  results?: VeritusPaper[];
}

export interface CreditsResponse {
  proTierCreditsBalance: number;
  proTierCreditsTotal: number;
  freeTierCreditsBalance: number;
  freeTierCreditsTotal: number;
  plan: string;
}

export type JobType = "keywordSearch" | "querySearch" | "combinedSearch";

export interface JobOptions {
  limit?: 100 | 200 | 300;
  fieldsOfStudy?: string[];
  minCitationCount?: number;
  openAccessPdf?: boolean;
  downloadable?: boolean;
  quartileRanking?: string[];
  publicationTypes?: string[];
  sort?: string;
  year?: string;
}

const VERITUS_API_URL =
  process.env.VERITUS_API_URL || "https://discover.veritus.ai/api";
const VERITUS_API_KEY = process.env.VERITUS_API_KEY || "";

// Rate limiter for Veritus API (10 requests per minute)
class RateLimiter {
  private timestamps: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number = 10, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  async waitForSlot(): Promise<void> {
    const now = Date.now();
    // Remove timestamps outside the window
    this.timestamps = this.timestamps.filter(t => now - t < this.windowMs);

    if (this.timestamps.length >= this.maxRequests) {
      // Calculate wait time until the oldest request expires
      const oldestTimestamp = this.timestamps[0];
      const waitTime = this.windowMs - (now - oldestTimestamp) + 100; // +100ms buffer
      console.log(`⏳ Rate limit reached. Waiting ${waitTime}ms before next Veritus API call...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      // Recursively check again after waiting
      return this.waitForSlot();
    }

    this.timestamps.push(now);
  }
}

// Global rate limiter instance (10 req/min as per Veritus docs)
const rateLimiter = new RateLimiter(10, 60000);

class VeritusClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string = VERITUS_API_KEY, baseUrl: string = VERITUS_API_URL) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  private getHeaders(): HeadersInit {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  private buildQueryString(options: JobOptions): string {
    const params = new URLSearchParams();

    if (options.limit) params.set("limit", options.limit.toString());
    if (options.fieldsOfStudy?.length) {
      params.set("fieldsOfStudy", options.fieldsOfStudy.join(","));
    }
    if (options.minCitationCount) {
      params.set("minCitationCount", options.minCitationCount.toString());
    }
    if (options.openAccessPdf !== undefined) {
      params.set("openAccessPdf", options.openAccessPdf.toString());
    }
    if (options.downloadable !== undefined) {
      params.set("downloadable", options.downloadable.toString());
    }
    if (options.quartileRanking?.length) {
      params.set("quartileRanking", options.quartileRanking.join(","));
    }
    if (options.publicationTypes?.length) {
      params.set("publicationTypes", options.publicationTypes.join(","));
    }
    if (options.sort) params.set("sort", options.sort);
    if (options.year) params.set("year", options.year);

    return params.toString();
  }

  // Search papers by title
  async searchPapers(title: string): Promise<VeritusPaper[]> {
    await rateLimiter.waitForSlot();
    
    const response = await fetch(
      `${this.baseUrl}/v1/papers/search?title=${encodeURIComponent(title)}`,
      {
        method: "GET",
        headers: this.getHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to search papers: ${response.statusText}`);
    }

    return response.json();
  }

  // Get paper by corpus ID
  async getPaper(corpusId: string): Promise<VeritusPaper> {
    await rateLimiter.waitForSlot();
    
    const response = await fetch(`${this.baseUrl}/v1/papers/${corpusId}`, {
      method: "GET",
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to get paper: ${response.statusText}`);
    }

    return response.json();
  }

  // Create a search job
  async createJob(
    jobType: JobType,
    body: CreateJobRequest,
    options: JobOptions = {}
  ): Promise<CreateJobResponse> {
    await rateLimiter.waitForSlot();
    
    const queryString = this.buildQueryString(options);
    const url = `${this.baseUrl}/v1/job/${jobType}${queryString ? `?${queryString}` : ""}`;

    const response = await fetch(url, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        `Failed to create job: ${response.statusText} - ${JSON.stringify(error)}`
      );
    }

    return response.json();
  }

  // Get job status
  async getJobStatus(jobId: string): Promise<JobStatusResponse> {
    await rateLimiter.waitForSlot();
    
    const response = await fetch(`${this.baseUrl}/v1/job/${jobId}`, {
      method: "GET",
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to get job status: ${response.statusText}`);
    }

    return response.json();
  }

  // Get user credits
  async getCredits(): Promise<CreditsResponse> {
    await rateLimiter.waitForSlot();
    
    const response = await fetch(`${this.baseUrl}/v1/user/getCredits`, {
      method: "GET",
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to get credits: ${response.statusText}`);
    }

    return response.json();
  }
}

export const veritusClient = new VeritusClient();
export { VeritusClient };

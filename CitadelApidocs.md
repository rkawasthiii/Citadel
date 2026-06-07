# Search API Documentation

> Comprehensive documentation for all API endpoints in the Veritus Search API.

## **Table of Contents**

* [<u>Authentication</u>](https://gist.github.com/Abdul535/5cda5d67285604415b7293343d643013#authentication)
* [<u>Base URL</u>](https://gist.github.com/Abdul535/5cda5d67285604415b7293343d643013#base-url)
* [<u>Endpoints</u>](https://gist.github.com/Abdul535/5cda5d67285604415b7293343d643013#endpoints)
  * [<u>Papers</u>](https://gist.github.com/Abdul535/5cda5d67285604415b7293343d643013#papers)
  * [<u>Jobs</u>](https://gist.github.com/Abdul535/5cda5d67285604415b7293343d643013#jobs)
  * [<u>User</u>](https://gist.github.com/Abdul535/5cda5d67285604415b7293343d643013#user)
* [<u>Error Handling</u>](https://gist.github.com/Abdul535/5cda5d67285604415b7293343d643013#error-handling)
* [<u>Examples</u>](https://gist.github.com/Abdul535/5cda5d67285604415b7293343d643013#examples)

## **Authentication**

All API endpoints require authentication using an API key. Include your API key in the Authorization header:

```
Authorization: Bearer YOUR_API_KEY
```

## **Base URL**

The base URL for all API endpoints is:

```
https://discover.veritus.ai/api
```

## **Endpoints**

### → **Papers**

#### GET `/v1/papers/search`

Search for papers by title.

**Headers:**

* `Authorization` (required): Bearer token with your API key (format: `Bearer YOUR_API_KEY`)

**Query Parameters:**

* `title` (required): The title of the paper to search for

**Response:**

* `200 OK`: Returns an array of matching papers

**Response Structure:**

```json  theme={null}
[
  {
    "abstract": "Paper abstract text or null",
    "authors": "Author1, Author2, Author3",
    "doi": "10.1234/example.doi",
    "downloadable": true,
    "engine": "ss-veritus",
    "fieldsOfStudy": ["Computer Science", "Mathematics"],
    "id": "paper_id_string",
    "impactFactor": {
      "citationCount": 150,
      "influentialCitationCount": 25,
      "referenceCount": 50
    },
    "isOpenAccess": true,
    "isPrePrint": false,
    "journalName": "Journal Name",
    "link": "https://example.com/paper",
    "pdfLink": "https://example.com/paper.pdf",
    "publicationType": "journal",
    "publishedAt": "2023-01-15",
    "score": 0.95,
    "semanticLink": "https://semanticscholar.org/paper/123",
    "title": "Paper Title",
    "titleLink": "https://example.com/paper",
    "tldr": "TLDR summary of the paper",
    "v_country": "United States",
    "v_journal_name": "Journal Name",
    "v_publisher": "Publisher Name",
    "v_quartile_ranking": "Q1",
    "year": 2023
  }
]
```

**Response Fields:**

* `abstract`: Paper abstract text (string or null)
* `authors`: Comma-separated list of author names (string)
* `doi`: Digital Object Identifier (string or null)
* `downloadable`: Whether the paper PDF is downloadable (boolean)
* `engine`: Search engine used (string, optional)
* `fieldsOfStudy`: Array of field of study categories (string array)
* `id`: Unique paper identifier (string)
* `impactFactor`: Object containing citation metrics:
  * `citationCount`: Total number of citations (number)
  * `influentialCitationCount`: Number of influential citations (number)
  * `referenceCount`: Number of references (number)
* `isOpenAccess`: Whether the paper is open access (boolean, optional)
* `isPrePrint`: Whether the paper is a preprint (boolean, optional)
* `journalName`: Name of the journal (string or null)
* `link`: URL to the paper (string, optional)
* `pdfLink`: URL to the PDF (string, optional)
* `publicationType`: Type of publication (string or null)
* `publishedAt`: Publication date (string or null)
* `score`: Relevance score (number or null)
* `semanticLink`: Link to Semantic Scholar page (string, optional)
* `title`: Paper title (string)
* `titleLink`: Link to paper title page (string, optional)
* `tldr`: TLDR summary (string or null)
* `v_country`: Country of publication venue (string or null)
* `v_journal_name`: Journal name from venue data (string or null)
* `v_publisher`: Publisher name (string or null)
* `v_quartile_ranking`: Quartile ranking (Q1, Q2, Q3, Q4, or null)
* `year`: Publication year (number or null)

**Example:**

```
curl -X GET "https://discover.veritus.ai/api/v1/papers/search?title=Machine%20Learning" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

***

#### GET `/v1/papers/{corpusId}`

Get a paper by its corpus ID.

**Headers:**

* `Authorization` (required): Bearer token with your API key (format: `Bearer YOUR_API_KEY`)

**Path Parameters:**

* `corpusId` (required): The corpus ID of the paper

**Response:**

* `200 OK`: Returns paper details

**Response Structure:**

```json  theme={null}
{
  "abstract": "Paper abstract text or null",
  "authors": "Author1, Author2, Author3",
  "doi": "10.1234/example.doi",
  "downloadable": true,
  "engine": "ss-veritus",
  "fieldsOfStudy": ["Computer Science", "Mathematics"],
  "id": "paper_id_string",
  "impactFactor": {
    "citationCount": 150,
    "influentialCitationCount": 25,
    "referenceCount": 50
  },
  "isOpenAccess": true,
  "isPrePrint": false,
  "journalName": "Journal Name",
  "link": "https://example.com/paper",
  "pdfLink": "https://example.com/paper.pdf",
  "publicationType": "journal",
  "publishedAt": "2023-01-15",
  "score": 0.95,
  "semanticLink": "https://semanticscholar.org/paper/123",
  "title": "Paper Title",
  "titleLink": "https://example.com/paper",
  "tldr": "TLDR summary of the paper",
  "v_country": "United States",
  "v_journal_name": "Journal Name",
  "v_publisher": "Publisher Name",
  "v_quartile_ranking": "Q1",
  "year": 2023
}
```

**Response Fields:**

See the Response Fields section under [GET `/v1/papers/search`](#get-v1paperssearch) for detailed field descriptions.

**Example:**

```
curl -X GET "https://discover.veritus.ai/api/v1/papers/12345678" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### → **Jobs**

#### POST `/v1/job/{jobType}`

Create a new search job. Jobs are asynchronous operations that can be checked for status later.

**Headers:**

* `Authorization` (required): Bearer token with your API key (format: `Bearer YOUR_API_KEY`)
* `Content-Type: application/json`

**Path Parameters:**

* `jobType` (required): Type of job to create. Must be one of:
  * `keywordSearch`: Search using phrases
  * `querySearch`: Search using a query string
  * `combinedSearch`: Search using both phrases and query

**Query Parameters:**

* `limit` (optional): Maximum number of results. Must be `100`, `200`, or `300`. Default: `100`
* `fieldsOfStudy` (optional): Comma-separated list of fields of study. Valid values:
  * `Computer Science`
  * `Medicine`
  * `Chemistry`
  * `Biology`
  * `Materials Science`
  * `Physics`
  * `Geology`
  * `Psychology`
  * `Art`
  * `History`
  * `Geography`
  * `Sociology`
  * `Business`
  * `Political Science`
  * `Economics`
  * `Philosophy`
  * `Mathematics`
  * `Engineering`
  * `Environmental Science`
  * `Agricultural and Food Sciences`
  * `Education`
  * `Law`
  * `Linguistics`
* `minCitationCount` (optional): Minimum number of citations. Must be a positive integer.
* `openAccessPdf` (optional): Filter for open access PDFs. Must be `true` or `false`.
* `downloadable` (optional): Filter for downloadable papers. Must be `true` or `false`.
* `quartileRanking` (optional): Filter by quartile ranking(s). Can be a single value or comma-separated list. Valid values: `Q1`, `Q2`, `Q3`, `Q4`. Example: `Q1` or `Q1,Q2,Q3`
* `publicationTypes` (optional): Comma-separated list of publication types. Valid values:
  * `journal`
  * `book series`
  * `conference`
* `sort` (optional): Sort order. Format: `field:direction`. Valid fields:
  * `score`
  * `citationCount`
  * `influentialCitationCount`
  * `quartileRanking`
  * `referenceCount`
  * `year`
* `year` (optional): Filter by year. Format: `YYYY` (single year) or `YYYY:YYYY` (year range). Example: `2020` or `2020:2023`

**Request Body:**

```
{
  "callbackUrl": "https://your-domain.com/webhook", // Optional: HTTPS URL for job completion callback
  "enrich": false, // Optional: Whether to enrich results. Default: false
  "phrases": ["phrase1", "phrase2", "phrase3"], // Required for keywordSearch and combinedSearch. Must have 3-10 phrases
  "query": "Your search query here" // Required for querySearch and combinedSearch. Must be 50-5000 characters
}
```

**Job Type Requirements:**

* `keywordSearch`: Requires `phrases` (3-10 phrases)
* `querySearch`: Requires `query` (50-5000 characters)
* `combinedSearch`: Requires either `phrases` (3-10 phrases) OR `query` (50-5000 characters), or both

**Credits Deduction:**

Credits are automatically deducted when a job is created. The deduction happens before the job is queued:

* **Credits Calculation**: Credits deducted = `Math.ceil(limit / 100)`
  * Example: `limit=100` → 1 credit, `limit=200` → 2 credits, `limit=300` → 3 credits

* **Credit Tier**:
  * If `enrich=true`: Uses **Pro Tier Credits** (`higherTierCreditsBalance`)
  * If `enrich=false`: Uses **Free Tier Credits** (`lowerTierCreditsBalance`)

* **Insufficient Credits**: If you don't have enough credits, the request will fail with a `403 Forbidden` error:

  ```
  {
    "error": "Insufficient credits"
  }
  ```

  **Response:**

* `200 OK`: Returns job creation response with job ID:

  ```
  {
    "jobId": "507f1f77bcf86cd799439011"
  }
  ```

* `403 Forbidden`: Insufficient credits

**Example - Keyword Search:**

```
curl -X POST "https://discover.veritus.ai/api/v1/job/keywordSearch?limit=100&fieldsOfStudy=Computer%20Science&minCitationCount=10" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "phrases": ["machine learning", "neural networks", "deep learning"],
    "callbackUrl": "https://your-domain.com/webhook",
    "enrich": true
  }'
```

**Example - Query Search:**

```
curl -X POST "https://discover.veritus.ai/api/v1/job/querySearch?limit=200&year=2020:2023" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "This is a detailed query about machine learning and artificial intelligence that describes what you are looking for in academic papers.",
    "callbackUrl": "https://your-domain.com/webhook"
  }'
```

**Example - Combined Search:**

```
curl -X POST "https://discover.veritus.ai/api/v1/job/combinedSearch?limit=300&openAccessPdf=true&quartileRanking=Q1,Q2&sort=citationCount:desc" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "phrases": ["natural language processing", "transformer models", "BERT"],
    "query": "Recent advances in transformer-based models for natural language understanding and generation",
    "callbackUrl": "https://your-domain.com/webhook",
    "enrich": true
  }'
```

***

#### → GET `/v1/job/{jobId}`

Get the status of a job by its job ID.

**Headers:**

* `Authorization` (required): Bearer token with your API key (format: `Bearer YOUR_API_KEY`)

**Path Parameters:**

* `jobId` (required): The job ID returned from job creation

**Response:**

* `200 OK`: Returns job status and results (if completed)

**Response Structure:**

**When status is `queued`:**

```json  theme={null}
{
  "status": "queued"
}
```

**When status is `error`:**

```json  theme={null}
{
  "status": "error"
}
```

**When status is `success`:**

```json  theme={null}
{
  "status": "success",
  "results": [
    {
      "abstract": "Paper abstract text or null",
      "authors": "Author1, Author2, Author3",
      "doi": "10.1234/example.doi",
      "downloadable": true,
      "engine": "ss-veritus",
      "fieldsOfStudy": ["Computer Science", "Mathematics"],
      "id": "paper_id_string",
      "impactFactor": {
        "citationCount": 150,
        "influentialCitationCount": 25,
        "referenceCount": 50
      },
      "isOpenAccess": true,
      "isPrePrint": false,
      "journalName": "Journal Name",
      "link": "https://example.com/paper",
      "pdfLink": "https://example.com/paper.pdf",
      "publicationType": "journal",
      "publishedAt": "2023-01-15",
      "score": 0.95,
      "semanticLink": "https://semanticscholar.org/paper/123",
      "title": "Paper Title",
      "titleLink": "https://example.com/paper",
      "tldr": "TLDR summary of the paper",
      "v_country": "United States",
      "v_journal_name": "Journal Name",
      "v_publisher": "Publisher Name",
      "v_quartile_ranking": "Q1",
      "year": 2023
    }
  ]
}
```

**Response Fields:**

* `status`: Job status. Possible values:
  * `queued`: Job is queued for processing
  * `success`: Job completed successfully
  * `error`: Job failed with an error
* `results`: Array of paper results (only present when `status` is `success`). Each result follows the same structure as described in the Response Fields section under [GET `/v1/papers/search`](#get-v1paperssearch).

**Example:**

```
curl -X GET "https://discover.veritus.ai/api/v1/job/507f1f77bcf86cd799439011" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

***

### → **User**

#### GET `/v1/user/getCredits`

Get your current credit balance and plan information.

**Headers:**

* `Authorization` (required): Bearer token with your API key (format: `Bearer YOUR_API_KEY`)

**Response:**

* `200 OK`: Returns credit balance information:

  ```
  {
    "proTierCreditsBalance": 50,
    "proTierCreditsTotal": 100,
    "freeTierCreditsBalance": 75,
    "freeTierCreditsTotal": 100,
    "plan": "free"
  }
  ```

**Response Fields:**

* `proTierCreditsBalance`: Current balance of Pro Tier credits (used when `enrich=true`)
* `proTierCreditsTotal`: Total Pro Tier credits ever allocated
* `freeTierCreditsBalance`: Current balance of Free Tier credits (used when `enrich=false`)
* `freeTierCreditsTotal`: Total Free Tier credits ever allocated
* `plan`: Your current plan (e.g., "free", "pro")

**Example:**

```
curl -X GET "https://discover.veritus.ai/api/v1/user/getCredits" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Note:** Check your credits before creating jobs to ensure you have sufficient balance. Credits are deducted immediately upon job creation.

***

## **Error Handling**

All endpoints return standard HTTP status codes:

* `200 OK`: Request successful
* `400 Bad Request`: Invalid request parameters or body
* `401 Unauthorized`: Missing or invalid API key
* `404 Not Found`: Resource not found
* `500 Internal Server Error`: Server error

Error responses follow this format:

```
{
  "error": [
    {
      "message": "Error message description",
      "path": "field.path"
    }
  ]
}
```

### **Common Error Scenarios**

1. **Missing API Key:**

   ```
   {
     "error": "API key is required"
   }
   ```

2. **Invalid Parameters:**

   ```
   {
     "error": [
       {
         "message": "At least 3 and at most 10 phrases are required",
         "path": "phrases"
       }
     ]
   }
   ```

3. **Invalid Callback URL:**

   ```
   {
     "error": [
       {
         "message": "Callback URL must be a valid HTTPS URL",
         "path": "callbackUrl"
       }
     ]
   }
   ```

4. **Insufficient Credits:**

   ```
   {
     "error": "Insufficient credits"
   }
   ```

   This error occurs when creating a job and you don't have enough credits in the appropriate tier (Pro Tier for enriched searches, Free Tier for non-enriched searches).

***

## **Examples**

### **Complete Workflow: Check Credits, Create Job, and Check Status**

```
# Step 1: Check your credit balance
curl -X GET "https://discover.veritus.ai/api/v1/user/getCredits" \
  -H "Authorization: Bearer YOUR_API_KEY"

# Step 2: Create a keyword search job (credits will be deducted)
JOB_RESPONSE=$(curl -X POST "https://discover.veritus.ai/api/v1/job/keywordSearch?limit=100" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "phrases": ["machine learning", "neural networks", "deep learning"],
    "callbackUrl": "https://your-domain.com/webhook"
  }')

# Extract job ID from response (example)
JOB_ID="507f1f77bcf86cd799439011"

# Step 3: Check job status
curl -X GET "https://discover.veritus.ai/api/v1/job/$JOB_ID" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### **Search with Multiple Filters**

```
curl -X POST "https://discover.veritus.ai/api/v1/job/combinedSearch?limit=200&fieldsOfStudy=Computer%20Science,Mathematics&minCitationCount=50&openAccessPdf=true&quartileRanking=Q1,Q2,Q3&year=2020:2023&sort=citationCount:desc" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "phrases": ["artificial intelligence", "machine learning", "deep learning"],
    "query": "Recent advances in AI and machine learning research",
    "enrich": true
  }'
```

### **Get Paper Details and Citations**

```
# Get paper details
curl -X GET "https://discover.veritus.ai/api/v1/papers/12345678" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

***

## **Notes**

1. **Callback URLs**: Must be valid HTTPS URLs. [Localhost](http://Localhost) URLs are not allowed.
2. **Query Length**: For query and combined searches, queries must be between 50 and 5000 characters.
3. **Phrases**: For keyword and combined searches, you must provide between 3 and 10 phrases.
4. **Rate Limiting**: API rate limits may apply 10req/min.
5. **Job Processing**: Jobs are processed asynchronously. Use the callback URL or poll the job status endpoint to check completion.
6. **Field Names**: Field names in query parameters are case-sensitive. Use exact values as specified in the documentation.
7. **Credits System**:
   * Credits are deducted immediately when a job is created (before queuing)
   * Credits required = `Math.ceil(limit / 100)` (e.g., limit 100 = 1 credit, limit 200 = 2 credits, limit 300 = 3 credits)
   * Pro Tier credits are used when `enrich=true`, Free Tier credits when `enrich=false`
   * Always check your credit balance using `/v1/user/getCredits` before creating jobs
   * If job creation fails due to insufficient credits, no credits are deducted

## Contact and Support

Need help or onboarding support?

**Email:** [support@veritus.ai](mailto:support@veritus.ai)\
**Website:** [www.veritus.ai](https://www.veritus.ai)\
**Offices:** Tokyo & Kobe, Japan

Veritus is backed by academic and government partners including JETRO, OIST Innovation Accelerator, and Lifetime Ventures Japan.


---

> To find navigation and other pages in this documentation, fetch the llms.txt file at: https://docs.veritus.ai/llms.txt
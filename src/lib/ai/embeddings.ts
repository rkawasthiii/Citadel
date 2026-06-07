import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Google AI client
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

/**
 * Generate embedding using Google's text-embedding-004 model
 * Returns 768-dimensional vector
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: "text-embedding-004" });

  // Truncate text if too long (max ~8000 tokens ≈ 32000 chars)
  const truncatedText = text.slice(0, 30000);

  const result = await model.embedContent(truncatedText);
  return result.embedding.values;
}

/**
 * Generate embeddings for multiple texts
 * Note: Processes sequentially to respect rate limits
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const model = genAI.getGenerativeModel({ model: "text-embedding-004" });

  const embeddings = await Promise.all(
    texts.map(async (text) => {
      const truncatedText = text.slice(0, 30000);
      const result = await model.embedContent(truncatedText);
      return result.embedding.values;
    })
  );

  return embeddings;
}

/**
 * Prepare paper content for embedding
 * Combines title, abstract, tldr for rich semantic representation
 */
export function preparePaperContent(paper: {
  title: string;
  abstract?: string | null;
  tldr?: string | null;
  authors?: string;
}): string {
  const parts = [`Title: ${paper.title}`];

  // TL;DR is most valuable - concise summary
  if (paper.tldr) {
    parts.push(`Summary: ${paper.tldr}`);
  }

  // Full abstract for depth
  if (paper.abstract) {
    parts.push(`Abstract: ${paper.abstract}`);
  }

  // Authors for attribution context
  if (paper.authors) {
    parts.push(`Authors: ${paper.authors}`);
  }

  return parts.join("\n\n");
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have the same length");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

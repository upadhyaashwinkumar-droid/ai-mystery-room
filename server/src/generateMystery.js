import { GoogleGenAI } from "@google/genai";
import { generatedMysterySchema } from "./schemas.js";

// Safely read from the .env file
const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";

export async function generateMystery(premise, difficulty) {
  if (!apiKey) {
    const error = new Error("Mystery generation is not configured. Set GEMINI_API_KEY in your .env file.");
    error.status = 503;
    throw error;
  }

  // Use the environment variable safely (note: it's apiKey, not apikey)
  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model,
    contents: [
      "Create a fair-play detective mystery for a web game. Return ONLY valid JSON matching the requested structure. Do not include markdown formatting like ```json.",
      `Premise: ${premise}`,
      `Difficulty: ${difficulty}. Easy should have direct evidence; medium should require connecting clues; hard should include plausible red herrings without contradictions.`,
      "Include 3-6 distinct suspects and 4-10 concrete clues. Every clue must be discoverable and the solution must be provable from the story and clues.",
      "Exactly one suspect must be the culprit. culpritIndex is the zero-based index of that suspect in the suspects array.",
      "Write a concise, atmospheric story, believable suspect biographies, 2-5 graduated hints, a clear explanation, and a 2-6 step logic chain."
    ].join("\n"),
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          story: { type: "STRING" },
          suspects: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING" },
                bio: { type: "STRING" },
                isCulprit: { type: "BOOLEAN" }
              },
              required: ["name", "bio", "isCulprit"]
            }
          },
          clues: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: { text: { type: "STRING" } },
              required: ["text"]
            }
          },
          hints: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: { text: { type: "STRING" } },
              required: ["text"]
            }
          },
          solution: {
            type: "OBJECT",
            properties: {
              culpritIndex: { type: "INTEGER" },
              explanation: { type: "STRING" },
              logicChain: { type: "ARRAY", items: { type: "STRING" } }
            },
            required: ["culpritIndex", "explanation", "logicChain"]
          }
        },
        required: ["story", "suspects", "clues", "hints", "solution"]
      }
    }
  });

  let generated;
  try {
    // Clean up markdown code blocks if Gemini adds them
    const cleanText = response.text.replace(/^```json\n?|\n?```$/g, "").trim();
    generated = generatedMysterySchema.parse(JSON.parse(cleanText));
  } catch (error) {
    console.error("Gemini returned an invalid mystery payload:", error, response.text);
    const invalid = new Error("The generated mystery was incomplete. Please try again.");
    invalid.status = 502;
    throw invalid;
  }

  const culpritCount = generated.suspects.filter((suspect) => suspect.isCulprit).length;
  if (
    culpritCount !== 1 ||
    generated.solution.culpritIndex >= generated.suspects.length ||
    !generated.suspects[generated.solution.culpritIndex].isCulprit
  ) {
    const invalid = new Error("The generated mystery failed its consistency check. Please try again.");
    invalid.status = 502;
    throw invalid;
  }

  return generated;
}
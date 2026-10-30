import "dotenv/config";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import mongoose from "mongoose";
import Case from "./models/Case.js";
import { generateMystery } from "./generateMystery.js";
import {
  accusationSchema,
  caseIdSchema,
  createCaseSchema,
  suspectIdSchema
} from "./schemas.js";

// Validate required environment variables on startup
const requiredEnvVars = ["MONGODB_URI", "GEMINI_API_KEY"];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    console.error("Please ensure your server/.env file contains all required keys.");
    process.exit(1);
  }
}

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173"
  })
);
app.use(express.json({ limit: "16kb" }));

function publicCase(mystery) {
  return {
    id: mystery.id,
    premise: mystery.premise,
    difficulty: mystery.difficulty,
    story: mystery.story,
    suspects: mystery.suspects.map(({ id, name }) => ({
      id,
      name,
      isRevealed: mystery.playerProgress.revealedSuspectIds.includes(id),
      ...(mystery.playerProgress.revealedSuspectIds.includes(id)
        ? { bio: mystery.suspects.find((suspect) => suspect.id === id).bio }
        : {})
    })),
    clues: mystery.clues
      .filter((clue) => clue.isDiscovered)
      .map(({ id, text }) => ({ id, text })),
    progress: {
      score: mystery.playerProgress.score,
      discoveredClueCount: mystery.playerProgress.discoveredClueIds.length,
      totalClueCount: mystery.clues.length,
      revealedSuspectIds: mystery.playerProgress.revealedSuspectIds,
      usedHintCount: mystery.playerProgress.usedHintIds.length,
      totalHintCount: mystery.hints.length
    },
    status: mystery.status
  };
}

function sendError(res, error) {
  if (error.name === "ZodError") {
    return res.status(400).json({ error: "Please check the submitted information." });
  }
  if (error.name === "CastError") {
    return res.status(400).json({ error: "Invalid case identifier." });
  }
  console.error(error);
  return res
    .status(error.status || 500)
    .json({ error: error.status ? error.message : "Something went wrong. Please try again." });
}

async function findActiveCase(caseId) {
  const validId = caseIdSchema.parse(caseId);
  const mystery = await Case.findById(validId);
  if (!mystery) {
    const error = new Error("Mystery not found.");
    error.status = 404;
    throw error;
  }
  if (mystery.status !== "active") {
    const error = new Error("This investigation has already been solved.");
    error.status = 409;
    throw error;
  }
  return mystery;
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", database: mongoose.connection.readyState === 1 ? "connected" : "disconnected" });
});

app.post("/api/cases", async (req, res) => {
  try {
    const { premise, difficulty } = createCaseSchema.parse(req.body);
    const generated = await generateMystery(premise, difficulty);

    // Base score logic based on difficulty (Easy: 100, Medium: 150, Hard: 200)
    const baseScores = { easy: 100, medium: 150, hard: 200 };
    const startingScore = baseScores[difficulty] || 100;

    const suspects = generated.suspects.map((suspect) => ({
      ...suspect,
      id: new mongoose.Types.ObjectId().toString()
    }));

    const mystery = await Case.create({
      premise,
      difficulty,
      story: generated.story,
      suspects,
      clues: generated.clues.map((clue) => ({
        ...clue,
        id: new mongoose.Types.ObjectId().toString()
      })),
      hints: generated.hints.map((hint) => ({
        ...hint,
        id: new mongoose.Types.ObjectId().toString()
      })),
      solution: {
        culpritId: suspects[generated.solution.culpritIndex].id,
        explanation: generated.solution.explanation,
        logicChain: generated.solution.logicChain
      },
      playerProgress: {
        score: startingScore // Start with base score
      }
    });
    res.status(201).json(publicCase(mystery));
  } catch (error) {
    sendError(res, error);
  }
});

app.get("/api/cases/:caseId", async (req, res) => {
  try {
    const mystery = await Case.findById(caseIdSchema.parse(req.params.caseId));
    if (!mystery) {
      return res.status(404).json({ error: "Mystery not found." });
    }
    return res.json(publicCase(mystery));
  } catch (error) {
    return sendError(res, error);
  }
});

app.post("/api/cases/:caseId/search", async (req, res) => {
  try {
    const mystery = await findActiveCase(req.params.caseId);
    const remaining = mystery.clues.filter(
      (clue) => !mystery.playerProgress.discoveredClueIds.includes(clue.id)
    );
    if (!remaining.length) {
      return res.status(409).json({ error: "You have uncovered every clue." });
    }
    const clue = remaining[Math.floor(Math.random() * remaining.length)];
    clue.isDiscovered = true;
    mystery.playerProgress.discoveredClueIds.push(clue.id);

    // Add +5 points for discovering a clue
    mystery.playerProgress.score += 5;

    await mystery.save();
    return res.json({ clue: { id: clue.id, text: clue.text }, mystery: publicCase(mystery) });
  } catch (error) {
    return sendError(res, error);
  }
});

app.post("/api/cases/:caseId/interrogate", async (req, res) => {
  try {
    const { suspectId } = suspectIdSchema.parse(req.body);
    const mystery = await findActiveCase(req.params.caseId);
    const suspect = mystery.suspects.find((candidate) => candidate.id === suspectId);
    if (!suspect) {
      return res.status(404).json({ error: "Suspect not found." });
    }
    if (!mystery.playerProgress.revealedSuspectIds.includes(suspectId)) {
      mystery.playerProgress.revealedSuspectIds.push(suspectId);
      await mystery.save();
    }
    return res.json({ suspect: { id: suspect.id, name: suspect.name, bio: suspect.bio } });
  } catch (error) {
    return sendError(res, error);
  }
});

app.post("/api/cases/:caseId/hint", async (req, res) => {
  try {
    const mystery = await findActiveCase(req.params.caseId);
    const hint = mystery.hints.find(
      (candidate) => !mystery.playerProgress.usedHintIds.includes(candidate.id)
    );
    if (!hint) {
      return res.status(409).json({ error: "You have used every hint." });
    }
    hint.isUsed = true;
    mystery.playerProgress.usedHintIds.push(hint.id);

    // Deduct 10 points for using a hint
    mystery.playerProgress.score = Math.max(0, mystery.playerProgress.score - 10);

    await mystery.save();
    return res.json({
      hint: { id: hint.id, text: hint.text },
      mystery: publicCase(mystery)
    });
  } catch (error) {
    return sendError(res, error);
  }
});

app.post("/api/cases/:caseId/accuse", async (req, res) => {
  try {
    const { suspectId, reasoning } = accusationSchema.parse(req.body);
    const mystery = await findActiveCase(req.params.caseId);
    if (!mystery.suspects.some((suspect) => suspect.id === suspectId)) {
      return res.status(404).json({ error: "Suspect not found." });
    }

    const correct = suspectId === mystery.solution.culpritId;
    mystery.playerProgress.accusation = suspectId;

    if (!correct) {
      mystery.playerProgress.score = Math.max(0, mystery.playerProgress.score - 25);
    }
    mystery.status = "solved";
    await mystery.save();

    return res.json({
      correct,
      score: mystery.playerProgress.score,
      reasoning,
      culprit: mystery.suspects.find((suspect) => suspect.id === mystery.solution.culpritId).name,
      explanation: mystery.solution.explanation,
      logicChain: mystery.solution.logicChain
    });
  } catch (error) {
    return sendError(res, error);
  }
});

app.use((error, _req, res, _next) => {
  sendError(res, error);
});

async function start() {
  // Securely read MongoDB URI from environment variables
  await mongoose.connect(process.env.MONGODB_URI);

  app.listen(port, () => {
    console.log(`✅ Mystery Room API listening on http://localhost:${port}`);
    console.log(`🔒 Environment variables loaded successfully`);
  });
}

start().catch((error) => {
  console.error("Unable to start Mystery Room API:", error);
  process.exitCode = 1;
});
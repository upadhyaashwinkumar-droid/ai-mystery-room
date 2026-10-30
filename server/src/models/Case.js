import mongoose from "mongoose";

const suspectSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    bio: { type: String, required: true },
    isCulprit: { type: Boolean, required: true }
  },
  { _id: false }
);

const clueSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
    isDiscovered: { type: Boolean, default: false }
  },
  { _id: false }
);

const hintSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
    isUsed: { type: Boolean, default: false }
  },
  { _id: false }
);

const CaseSchema = new mongoose.Schema(
  {
    premise: { type: String, required: true },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      required: true
    },
    story: { type: String, required: true },
    suspects: { type: [suspectSchema], required: true },
    clues: { type: [clueSchema], required: true },
    hints: { type: [hintSchema], required: true },
    solution: {
      culpritId: { type: String, required: true },
      explanation: { type: String, required: true },
      logicChain: { type: [String], required: true }
    },
    playerProgress: {
      score: { type: Number, default: 100 },
      discoveredClueIds: { type: [String], default: [] },
      usedHintIds: { type: [String], default: [] },
      revealedSuspectIds: { type: [String], default: [] },
      accusation: { type: String, default: null }
    },
    status: {
      type: String,
      enum: ["active", "solved"],
      default: "active"
    }
  },
  { timestamps: true }
);

export default mongoose.model("Case", CaseSchema);

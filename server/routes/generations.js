import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { cancelGeneration } from "../services/ai.service.js";

const router = express.Router();

router.use(requireAuth);

// POST /api/v1/generations/:generationId/cancel
router.post("/:generationId/cancel", (req, res) => {
  const { generationId } = req.params;
  const cancelled = cancelGeneration(generationId);

  return res.status(200).json({
    success: true,
    data: {
      generationId,
      cancelled,
      message: cancelled
        ? "Generation cancelled successfully."
        : "Generation not found or already finished.",
    },
  });
});

export default router;

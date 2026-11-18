
import express from "express";
import cors from "cors";
import multer from "multer";

const app = express();

app.use(cors({
  origin: [
    "https://rsgamingmod.github.io"
  ],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json({ limit: "30kb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (!file.mimetype.startsWith("audio/")) {
      return cb(new Error("Audio files only"));
    }
    cb(null, true);
  }
});

const API_KEY = process.env.ELEVENLABS_API_KEY;

app.get("/", (req, res) => {
  res.send("AI Voice Clone Backend is running.");
});

app.post("/api/clone", upload.single("audio"), async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(500).json({ error: "API key missing" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "Audio required" });
    }

    const name = (req.body.name || "My Voice").trim();

    const form = new FormData();

    form.append("files",
  new Blob([req.file.buffer], { type: req.file.mimetype }),
  req.file.originalname
);

    form.append("name", name);

    const response = await fetch(
      "https://api.elevenlabs.io/v1/voices/add",
      {
        method: "POST",
        headers: {
          "xi-api-key": API_KEY
        },
        body: form
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("ElevenLabs Clone Error:", JSON.stringify(data));
      return res.status(response.status).json({
        error: data.detail?.message || JSON.stringify(data.detail || data)
      });
    }

    res.json({
      success: true,
      voice_id: data.voice_id
    });

  } catch (e) {
    console.error("Clone Error:", e);
    res.status(500).json({ error: e.message || "Clone failed" });
  }
});

app.post("/api/speech", async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(500).json({ error: "API key missing" });
    }

    const { voice_id, text, speed } = req.body;

    if (
      typeof voice_id !== "string" ||
      !/^[a-zA-Z0-9_-]{5,100}$/.test(voice_id)
    ) {
      return res.status(400).json({ error: "Invalid voice ID" });
    }

    if (
      typeof text !== "string" ||
      !text.trim() ||
      text.length > 5000
    ) {
      return res.status(400).json({ error: "Invalid text" });
    }

    const safeSpeed = Math.min(1.2, Math.max(0.7, Number(speed) || 1));

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice_id}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text: text.trim(),
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.8,
            style: 0,
            use_speaker_boost: true,
            speed: safeSpeed
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Speech Error:", errorText);

      return res.status(response.status).json({
        error: "Speech generation failed",
        details: errorText
      });
    }

    res.setHeader("Content-Type", "audio/mpeg");
    res.send(Buffer.from(await response.arrayBuffer()));

  } catch (e) {
    console.error("Speech Error:", e);
    res.status(500).json({
      error: e.message || "Speech generation failed"
    });
  }
});

app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  res.status(400).json({
    error: err.message || "Invalid request"
  });
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Voice Clone Backend started");
});

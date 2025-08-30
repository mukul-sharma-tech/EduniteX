const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
dotenv.config();

const app = express();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Configure CORS to allow requests from the frontend
app.use(cors({
  origin: ['http://localhost:8000', 'http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.post('/extract-pdf', upload.single('pdf'), async (req, res) => {
  try {
    const data = await pdfParse(req.file.buffer);
    const rawText = data.text;

    // Return first 5 non-empty lines
    const questions = rawText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .slice(0, 5);

    res.json({ questions });
  } catch (err) {
    console.error('Error parsing PDF:', err);
    res.status(500).json({ error: 'Failed to parse PDF.' });
  }
});

app.post('/extract-text-pdf', upload.single('pdf'), async (req, res) => {
  try {
    const data = await pdfParse(req.file.buffer);
    const rawText = data.text;

    res.json({ text: rawText });
  } catch (err) {
    console.error('Error parsing PDF:', err);
    res.status(500).json({ error: 'Failed to parse PDF.' });
  }
});


const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

app.post("/chat", async (req, res) => {
  const { message, context = [] } = req.body;

  // Handle "open ..." command
  if (message.toLowerCase().startsWith("open ")) {
    const query = message.toLowerCase().replace("open ", "").trim();
    const domain = query.replace(/\s+/g, "");
    const directUrl = `https://${domain}.com`;
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

    return res.json({
      response: `Opening ${query}...`,
      openUrl: directUrl,
      fallbackUrl: searchUrl,
    });
  }

  try {
    // Format chat history to Gemini format
    const formattedHistory = context.map(msg => ({
      role: msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    const chat = model.startChat({ history: formattedHistory });

    const result = await chat.sendMessage(message);
    const responseText = result.response.text();

    res.json({ response: responseText });
  } catch (error) {
    console.error("Gemini error:", error);
    res.status(500).json({ error: "Something went wrong!" });
  }
});

app.post("/solve-doubt", async (req, res) => {
  console.log('[DEBUG] Solve-doubt endpoint called with:', req.body);
  const { doubt, studentName, subject } = req.body;

  if (!doubt) {
    console.log('[DEBUG] No doubt text provided');
    return res.status(400).json({ error: "Doubt text is required" });
  }

  try {
    const prompt = `You are a teacher helping ${studentName} with a doubt in ${subject || 'general studies'}.

Doubt: "${doubt}"

Give a short, clear solution (3-5 sentences). 
Use simple language, examples if needed, and be encouraging.`;

    console.log('[DEBUG] Sending prompt to Gemini:', prompt);
    const result = await model.generateContent(prompt);
    const solution = result.response.text();
    console.log('[DEBUG] Gemini response received, length:', solution.length);

    res.json({ solution });
  } catch (error) {
    console.error("Error solving doubt with Gemini:", error);
    res.status(500).json({ error: "Failed to generate solution" });
  }
});


const PORT = 5001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

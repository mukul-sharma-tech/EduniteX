import React, { useState } from "react";
import axios from "axios";

const DoubtSolver = () => {

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);


  // Clean AI Text
  const cleanText = (text) => {
    return text
      .replace(/[#*_`~>|]/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  };


  // Ask Ollama
  const solveDoubt = async () => {

    if (!question.trim()) return;

    setLoading(true);
    setAnswer("");

    try {

      const res = await axios.post(
        "http://localhost:11434/api/generate",
        {
          model: "gpt-oss:120b-cloud",
          prompt: `
You are a helpful teacher.
Explain simply.
No markdown.
No symbols.

Question:
${question}

Answer:
`,
          stream: false,
        }
      );

      const cleaned = cleanText(res.data.response);

      setAnswer(cleaned);

    } catch (err) {

      console.error(err);

      setAnswer("❌ Ollama not running or blocked.");

    } finally {

      setLoading(false);

    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-slate-900 flex items-center justify-center p-4">

      <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl max-w-2xl w-full p-6">

        {/* Title */}
        <h1 className="text-3xl font-bold text-center text-yellow-400 mb-4">
          📘 AI Doubt Solver
        </h1>

        <p className="text-center text-gray-300 mb-6">
          Ask any study doubt. Get simple explanation.
        </p>


        {/* Input */}
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Type your doubt here..."
          rows="4"
          className="w-full p-3 rounded-lg bg-white text-gray-900 outline-none focus:ring-2 focus:ring-yellow-400"
        />


        {/* Button */}
        <button
          onClick={solveDoubt}
          disabled={loading}
          className="w-full mt-4 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold py-2 rounded-lg transition disabled:opacity-60"
        >
          {loading ? "Solving..." : "Solve Doubt"}
        </button>


        {/* Answer */}
        {answer && (
          <div className="mt-6 bg-black/30 p-4 rounded-xl text-white whitespace-pre-line leading-relaxed">
            <h3 className="font-semibold text-green-400 mb-2">
              ✅ Answer:
            </h3>

            {answer}
          </div>
        )}

      </div>

    </div>
  );
};

export default DoubtSolver;

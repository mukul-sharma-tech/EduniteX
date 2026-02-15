import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, RefreshCcw, Home, Award, Bot, Loader2 } from 'lucide-react';

const TestResult = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const [aiFeedback, setAiFeedback] = useState("");
  const [analyzing, setAnalyzing] = useState(false);

  const { questions, userAnswers } = state || { questions: [], userAnswers: {} };

  // Trigger AI Analysis on load
  useEffect(() => {
    if (questions.length > 0) {
      analyzeResultsWithAI();
    }
  }, []);

  const analyzeResultsWithAI = async () => {
    setAnalyzing(true);
    try {
      // Create a string of results for the AI to read
      const performanceSummary = questions.map((q, i) => (
        `Question: ${q.question} | Student Answer: ${userAnswers[i] || "Skipped"} | Correct Answer: ${q.answer}`
      )).join('\n');

      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3.2', // Ensure this matches your local model name
          prompt: `As an AI Tutor for EduniteX, analyze this student's test performance. 
          Provide a brief, encouraging summary (3-4 sentences) highlighting what they know well and which specific topics they need to revisit. 
          
          Results data:
          ${performanceSummary}`,
          stream: false,
        }),
      });

      const data = await response.json();
      setAiFeedback(data.response);
    } catch (err) {
      console.error("AI Analysis failed:", err);
      setAiFeedback("Unable to reach AI Tutor. Review your incorrect answers below to improve!");
    } finally {
      setAnalyzing(false);
    }
  };

  const calculateScore = () => {
    let score = 0;
    questions.forEach((q, index) => {
      if (userAnswers[index] === q.answer) score++;
    });
    return score;
  };

  const score = calculateScore();
  const total = questions.length;
  const percentage = total > 0 ? (score / total) * 100 : 0;

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <button onClick={() => navigate('/tests/available')} className="text-blue-400">
          No results found. Go back to Tests.
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white pt-24 pb-20 px-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-3xl mx-auto"
      >
        {/* SCORE CARD */}
        <div className="bg-slate-800 rounded-3xl p-8 border border-slate-700 shadow-2xl text-center mb-8">
          <Award className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-2">Test Completed!</h1>
          
          <div className="inline-block p-6 bg-slate-900/50 rounded-2xl border border-blue-500/30 my-4">
            <span className="text-6xl font-black text-blue-400">{score}</span>
            <span className="text-2xl text-slate-500"> / {total}</span>
            <p className="mt-3 font-bold text-blue-300">
              {percentage === 100 ? "PERFECT! 🎯" : percentage >= 70 ? "GREAT JOB! 🚀" : "KEEP LEARNING! 📚"}
            </p>
          </div>
        </div>

        {/* AI TUTOR FEEDBACK SECTION */}
        <div className="bg-blue-600/10 border border-blue-500/30 rounded-3xl p-6 mb-8 shadow-lg shadow-blue-500/5">
          <div className="flex items-center gap-3 mb-4 text-blue-400">
            <Bot size={28} className="animate-pulse" />
            <h2 className="text-xl font-bold font-mono uppercase tracking-wider">AI tutor Analysis</h2>
          </div>
          
          {analyzing ? (
            <div className="flex items-center gap-3 text-slate-400 py-4">
              <Loader2 className="animate-spin" size={20} />
              <p className="italic font-light">Analyzing your performance patterns...</p>
            </div>
          ) : (
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-slate-300 leading-relaxed italic border-l-2 border-blue-500/50 pl-4"
            >
              {aiFeedback}
            </motion.p>
          )}
        </div>

        {/* DETAILED BREAKDOWN */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest ml-2">Review Questions</h3>
          {questions.map((q, index) => {
            const isCorrect = userAnswers[index] === q.answer;
            return (
              <div key={index} className={`p-6 rounded-2xl border ${isCorrect ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                <div className="flex gap-4">
                  {isCorrect ? <CheckCircle2 className="text-green-500 shrink-0" /> : <XCircle className="text-red-500 shrink-0" />}
                  <div>
                    <p className="font-bold text-lg mb-3">{index + 1}. {q.question}</p>
                    <p className="text-sm">
                      <span className="text-slate-500">Your Answer: </span>
                      <span className={isCorrect ? "text-green-400" : "text-red-400"}>{userAnswers[index] || "Skipped"}</span>
                    </p>
                    {!isCorrect && (
                      <p className="text-sm mt-1 text-green-400">
                        <span className="text-slate-500">Correct: </span>{q.answer}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* NAVIGATION */}
        <div className="flex flex-col sm:flex-row gap-4 mt-12">
          <button onClick={() => navigate('/tests/available')} className="flex-1 bg-slate-800 p-4 rounded-2xl font-bold flex items-center justify-center gap-2 border border-slate-700">
            <RefreshCcw size={18} /> Try Another
          </button>
          <button onClick={() => navigate('/')} className="flex-1 bg-blue-600 p-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20">
            <Home size={18} /> Exit to Home
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default TestResult;
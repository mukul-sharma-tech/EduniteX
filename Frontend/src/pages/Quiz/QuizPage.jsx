import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Brain, CheckCircle } from 'lucide-react';

const QuizPage = () => {
  const { state } = useLocation();
  const navigate = useNavigate();

  const content =
    state?.content ||
    localStorage.getItem('eduassist_quiz_content') ||
    '';

  const [questions, setQuestions] = useState([]);
  const [userAnswers, setUserAnswers] = useState({});
  const [loading, setLoading] = useState(true);

  const prompt = `
Generate 5 multiple choice questions from the text below.

Return ONLY valid JSON.

[
  {
    "question": "...",
    "options": ["A","B","C","D"],
    "answer": "A"
  }
]

Text:
"""${content}"""
`;

  useEffect(() => {
    const generateQuiz = async () => {
      try {
        const res = await fetch('http://localhost:11434/api/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-oss:120b-cloud',
            prompt,
            stream: false,
          }),
        });

        const data = await res.json();

        const text = data.response;

        const jsonText = text.match(/\[.*\]/s)?.[0];

        if (!jsonText) {
          throw new Error('Invalid JSON');
        }

        const quiz = JSON.parse(jsonText);

        setQuestions(quiz);

      } catch (err) {
        console.error('Quiz Error:', err);
        alert('❌ Failed to generate quiz');
      } finally {
        setLoading(false);
      }
    };

    generateQuiz();
  }, [content]);

  const handleSubmit = () => {
    navigate('/quiz-result', {
      state: { questions, userAnswers, content },
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <p className="text-xl animate-pulse">
          ⚙️ Generating Quiz...
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-900 pt-20 pb-24 px-6"
    >
      <h1 className="text-4xl font-bold text-center text-blue-400 mb-8 flex justify-center gap-2">
        <Brain />
        AI Quiz
      </h1>

      <div className="max-w-3xl mx-auto space-y-6">
        {questions.map((q, index) => (
          <div
            key={index}
            className="p-5 bg-white/70 rounded-xl shadow"
          >
            <p className="font-semibold mb-3">
              {index + 1}. {q.question}
            </p>

            {q.options.map((opt, i) => (
              <label key={i} className="block mb-2 cursor-pointer">
                <input
                  type="radio"
                  name={`q${index}`}
                  value={opt}
                  onChange={() =>
                    setUserAnswers((prev) => ({
                      ...prev,
                      [index]: opt,
                    }))
                  }
                  className="mr-2"
                />
                {opt}
              </label>
            ))}
          </div>
        ))}
      </div>

      <div className="text-center mt-10">
        <button
          onClick={handleSubmit}
          className="bg-blue-500 hover:bg-blue-600 px-6 py-2 text-white rounded-xl flex gap-2 mx-auto"
        >
          <CheckCircle />
          Submit
        </button>
      </div>
    </motion.div>
  );
};

export default QuizPage;

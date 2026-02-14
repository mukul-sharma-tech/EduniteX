import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, RotateCcw } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

const QuizResult = () => {
  const { state } = useLocation();
  const navigate = useNavigate();

  const storedContent =
    localStorage.getItem('eduassist_quiz_content') || '';

  const {
    questions = [],
    userAnswers = {},
    content = storedContent,
  } = state || {};

  const [saveMessage, setSaveMessage] = useState(null);
  const [saveStatus, setSaveStatus] = useState(null);

  const email = localStorage.getItem('eduassist_user_email');

  const score = questions.reduce((t, q, i) => {
    return t + (userAnswers[i] === q.answer ? 1 : 0);
  }, 0);

  useEffect(() => {
    const saveTraits = async () => {
      if (!email || !questions.length) return;

      // Get student id
      const { data: studentData } = await supabase
        .from('students')
        .select('id')
        .eq('email', email)
        .single();

      if (!studentData) return;

      const student_id = studentData.id;

      // Extract topic via Ollama
      let topicName = content.slice(0, 80);

      if (content.length > 300) {
        try {
          const prompt = `
Give a short topic name (max 5 words).
Return only topic.

"""${content}"""
`;

          const res = await fetch(
            'http://localhost:11434/api/generate',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'gpt-oss:120b-cloud',
                prompt,
                stream: false,
              }),
            }
          );

          const data = await res.json();

          if (data.response) {
            topicName = data.response.trim();
          }

        } catch (err) {
          console.error(err);
        }
      }

      const strengths = score >= 3 ? [topicName] : [];
      const weaknesses = score < 3 ? [topicName] : [];

      // Fetch existing
      const { data: traits } = await supabase
        .from('student_traits')
        .select('strengths, weaknesses')
        .eq('student_id', student_id)
        .single();

      const mergedStrengths = [
        ...new Set([...(traits?.strengths || []), ...strengths]),
      ];

      const mergedWeaknesses = [
        ...new Set([...(traits?.weaknesses || []), ...weaknesses]),
      ];

      // Save
      const { error } = await supabase
        .from('student_traits')
        .upsert({
          student_id,
          strengths: mergedStrengths,
          weaknesses: mergedWeaknesses,
        });

      if (error) {
        setSaveStatus('error');
        setSaveMessage('❌ Save failed');
      } else {
        setSaveStatus('success');
        setSaveMessage('✅ Progress saved');
        localStorage.removeItem('eduassist_quiz_content');
      }

      setTimeout(() => {
        setSaveMessage(null);
        setSaveStatus(null);
      }, 4000);
    };

    saveTraits();
  }, [email, questions, userAnswers]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen bg-slate-900 p-6 text-white"
    >
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold mb-4 text-blue-400 flex justify-center gap-2">
          <Trophy /> Quiz Result
        </h1>

        <p className="text-xl">
          🎯 Score: {score}/{questions.length}
        </p>
      </div>

      {saveMessage && (
        <div
          className={`max-w-xl mx-auto mb-6 p-3 rounded ${
            saveStatus === 'success'
              ? 'bg-green-200 text-green-800'
              : 'bg-red-200 text-red-800'
          }`}
        >
          {saveMessage}
        </div>
      )}

      <div className="space-y-4 max-w-3xl mx-auto">
        {questions.map((q, i) => (
          <div
            key={i}
            className="bg-white/70 text-black p-4 rounded-xl"
          >
            <p className="font-semibold">
              {i + 1}. {q.question}
            </p>

            <p className="text-sm mt-1">
              ✅ Correct: {q.answer} <br />
              🧍 Yours:{' '}
              <span
                className={
                  userAnswers[i] === q.answer
                    ? 'text-green-600'
                    : 'text-red-600 font-semibold'
                }
              >
                {userAnswers[i] || 'Not answered'}
              </span>
            </p>
          </div>
        ))}
      </div>

      <div className="flex justify-center mt-10">
        <button
          onClick={() => navigate('/quiz-generate')}
          className="bg-blue-500 px-6 py-2 rounded-xl hover:bg-blue-600 flex gap-2"
        >
          <RotateCcw /> Try Again
        </button>
      </div>
    </motion.div>
  );
};

export default QuizResult;

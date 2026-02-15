import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';

const StudentTestTaker = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth(); // 2. Access student profile
  const [userAnswers, setUserAnswers] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const questions = state?.questions || [];
  const title = state?.title || "Assessment";
  const testId = state?.testId;

  const handleSubmit = async () => {
    if (isSubmitting) return;

    // 1. Calculate Score locally
    let score = 0;
    questions.forEach((q, index) => {
      if (userAnswers[index] === q.answer) score++;
    });

    setIsSubmitting(true);

    try {
      // 2. Validation: Ensure Auth profile exists
      if (!profile) {
        throw new Error("User profile not found. Please log in again.");
      }

      // 3. Save to test_submissions table
      const { error } = await supabase
        .from('test_submissions')
        .insert([
          {
            test_id: testId,
            student_id: profile.auth_id, // 4. Uses the unique auth_id from your students table
            student_name: profile.name,   // 5. Uses real name from DB
            score: score,
            total_questions: questions.length,
          }
        ]);

      if (error) {
        console.error("Supabase Insert Error:", error);
        throw error;
      }

      // 6. Success! Move to Results
      navigate('/tests/result', {
        state: { questions, userAnswers }
      });
      
    } catch (err) {
      console.error("Submission Error Details:", err);
      alert("❌ Save Failed: " + (err.message || "Unknown Error"));
      // Navigate anyway so the student can still see their AI analysis
      navigate('/tests/result', { state: { questions, userAnswers } });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="text-center">
          <p className="mb-4">No test data found. Please go back.</p>
          <button onClick={() => navigate(-1)} className="text-blue-400 hover:underline">Return to Dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white pt-20 pb-24 px-6">
      <div className="max-w-3xl mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors">
          <ArrowLeft size={18} /> Back to Dashboard
        </button>

        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-blue-400">{title}</h1>
          <div className="text-right text-xs text-slate-500 uppercase tracking-widest">
            Student: <span className="text-slate-300">{profile?.name}</span>
          </div>
        </div>

        <div className="space-y-6">
          {questions.map((q, index) => (
            <motion.div 
              key={index} 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="p-6 bg-slate-800 rounded-2xl border border-slate-700 shadow-lg"
            >
              <p className="font-bold text-lg mb-4 text-slate-100">{index + 1}. {q.question}</p>
              <div className="space-y-3">
                {q.options.map((opt, i) => (
                  <label key={i} className={`block p-4 rounded-xl border cursor-pointer transition-all duration-200 ${userAnswers[index] === opt ? 'bg-blue-600/20 border-blue-500 ring-1 ring-blue-500' : 'bg-slate-700/30 border-slate-600 hover:bg-slate-700/50 hover:border-slate-500'}`}>
                    <input
                      type="radio"
                      name={`question-${index}`}
                      className="hidden"
                      onChange={() => setUserAnswers({...userAnswers, [index]: opt})}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        <button 
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full mt-10 bg-green-600 hover:bg-green-500 disabled:bg-slate-700 py-4 rounded-2xl font-bold text-lg shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3"
        >
          {isSubmitting ? <Loader2 className="animate-spin" /> : <CheckCircle size={22} />}
          {isSubmitting ? "Saving Results..." : "Finish & View Score"}
        </button>
      </div>
    </div>
  );
};

export default StudentTestTaker;
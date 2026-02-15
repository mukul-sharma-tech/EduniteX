import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { motion } from 'framer-motion';
import { ClipboardList, ArrowRight, BookOpen, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const AvailableTests = () => {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { profile } = useAuth(); // 2. Access student profile

  // 3. Dynamically get class from the logged-in student's record
  const studentClass = profile?.class || "N/A";

  useEffect(() => {
    const fetchTests = async () => {
      if (!profile) return; // Wait until profile is loaded

      try {
        const { data, error } = await supabase
          .from('tests')
          .select('*')
          .eq('class', studentClass) // 4. Filter by the real class
          .order('created_at', { ascending: false });

        if (error) throw error;
        setTests(data);
      } catch (err) {
        console.error("Error fetching tests:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTests();
  }, [profile, studentClass]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white">
        <Loader2 className="w-10 h-10 animate-spin text-blue-400 mb-4" />
        <p>Fetching assigned tests...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white pt-24 pb-20 px-6">
      <div className="max-w-5xl mx-auto">
        <header className="mb-12">
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-4xl font-bold text-blue-400 flex items-center gap-3">
                <ClipboardList size={36} />
                Available Assessments
              </h1>
              <p className="text-slate-400 mt-2">
                Logged in as: <span className="text-white font-medium">{profile?.name}</span>
              </p>
            </div>
            <div className="text-right">
              <span className="bg-blue-600/20 text-blue-400 px-4 py-1 rounded-full border border-blue-500/30 text-sm font-bold">
                Class {studentClass}
              </span>
            </div>
          </div>
        </header>

        {tests.length === 0 ? (
          <div className="text-center py-20 bg-slate-800/50 rounded-3xl border border-dashed border-slate-700">
            <BookOpen className="mx-auto w-12 h-12 text-slate-600 mb-4" />
            <p className="text-slate-500 text-xl">No tests assigned to class {studentClass} yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tests.map((test) => (
              <motion.div
                key={test.id}
                whileHover={{ y: -5 }}
                className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <span className="bg-blue-500/20 text-blue-400 text-xs font-bold px-3 py-1 rounded-full uppercase">
                      {test.subject}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold mb-2 text-slate-100">{test.title}</h3>
                  <p className="text-slate-400 text-sm mb-6">
                    Total Questions: {test.questions?.length || 0}
                  </p>
                </div>

                <button
                  onClick={() =>
                    navigate(`/tests/take/${test.id}`, {
                      state: {
                        questions: test.questions,
                        title: test.title,
                        testId: test.id 
                      }
                    })
                  }
                  className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all group shadow-lg shadow-blue-900/20"
                >
                  Start Test
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AvailableTests;
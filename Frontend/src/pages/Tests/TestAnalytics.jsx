import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Trophy, ChevronLeft, BarChart3, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const TestAnalytics = () => {
  const [tests, setTests] = useState([]);
  const [selectedTestSubmissions, setSelectedTestSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTestId, setSelectedTestId] = useState(null);
  
  const navigate = useNavigate();
  const { user } = useAuth(); 

  useEffect(() => {
    const fetchTeacherDataAndTests = async () => {
      setLoading(true);
      try {
        // 1. First, get the custom 'teacher_id' (e.g., T001) using the auth_id
        // Your schema says: teachers table has auth_id and teacher_id
        const { data: teacherProfile, error: profileError } = await supabase
          .from('teachers')
          .select('teacher_id')
          .eq('auth_id', user?.id)
          .single();

        if (profileError || !teacherProfile) {
          console.error("Could not find teacher profile for this auth user");
          setLoading(false);
          return;
        }

        const customTeacherId = teacherProfile.teacher_id;
        console.log("✅ Found custom Teacher ID:", customTeacherId);

        // 2. Fetch tests using that CUSTOM teacher_id (not the auth UUID)
        const { data: testsData, error: testsError } = await supabase
          .from('tests')
          .select('*')
          .eq('teacher_id', customTeacherId)
          .order('created_at', { ascending: false });

        if (testsError) throw testsError;
        setTests(testsData || []);

      } catch (err) {
        console.error("❌ Error in retrieval chain:", err.message);
      } finally {
        setLoading(false);
      }
    };

    if (user?.id) fetchTeacherDataAndTests();
  }, [user]);

  const viewRankings = async (testId) => {
    setSelectedTestId(testId);
    
    // 3. Fetch submissions. 
    // Since there is no foreign key between submissions and students in your schema, 
    // we use the 'student_name' column you wisely included in test_submissions!
    const { data, error } = await supabase
      .from('test_submissions')
      .select('id, student_name, score, total_questions, created_at')
      .eq('test_id', testId);

    if (error) {
      console.error("❌ Error fetching submissions:", error.message);
    } else {
      // 4. Sort by score (Highest first)
      const sorted = (data || []).sort((a, b) => b.score - a.score);
      setSelectedTestSubmissions(sorted);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
      <Loader2 className="animate-spin text-purple-500 w-12 h-12" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0f172a] text-white p-8">
      <div className="max-w-7xl mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-400 mb-6 hover:text-white transition-colors">
          <ChevronLeft size={20} /> Back to Hub
        </button>

        <header className="mb-10">
          <h1 className="text-4xl font-bold flex items-center gap-3">
            <BarChart3 className="text-purple-500" /> Test Analytics
          </h1>
          <p className="text-gray-400 mt-2">Ranking students based on performance</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Sidebar: Tests Created by Teacher */}
          <div className="lg:col-span-4 space-y-4">
            <h2 className="text-sm font-bold text-gray-500 uppercase">Select Test</h2>
            {tests.length === 0 ? (
              <div className="p-4 bg-gray-800/50 border border-dashed border-gray-700 rounded-xl text-center text-gray-500">
                No tests found for your ID.
              </div>
            ) : (
              tests.map(test => (
                <div 
                  key={test.id} 
                  onClick={() => viewRankings(test.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    selectedTestId === test.id ? 'border-purple-500 bg-purple-500/10' : 'bg-[#1e293b] border-gray-700 hover:border-gray-500'
                  }`}
                >
                  <h3 className="font-bold">{test.title}</h3>
                  <p className="text-xs text-gray-500">{test.subject} • {test.class}</p>
                </div>
              ))
            )}
          </div>

          {/* Leaderboard Section */}
          <div className="lg:col-span-8 bg-[#1e293b] rounded-2xl p-8 border border-gray-700 shadow-xl">
            <h2 className="text-2xl font-bold mb-8 flex items-center gap-3">
              <Trophy className="text-yellow-400" /> Student Leaderboard
            </h2>

            {selectedTestSubmissions.length > 0 ? (
              <div className="space-y-4">
                {selectedTestSubmissions.map((sub, index) => (
                  <div key={sub.id} className={`flex items-center justify-between p-5 rounded-xl border ${index === 0 ? 'bg-yellow-400/5 border-yellow-400/20' : 'bg-[#0f172a] border-gray-800'}`}>
                    <div className="flex items-center gap-6">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black ${index === 0 ? 'bg-yellow-400 text-black' : 'bg-gray-800 text-gray-400'}`}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="text-xl font-bold">{sub.student_name || "Anonymous Student"}</p>
                        <p className="text-sm text-gray-500">{new Date(sub.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-mono font-bold text-purple-400">
                        {sub.score} / {sub.total_questions}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20 text-gray-500">
                {selectedTestId ? "No submissions for this test yet." : "Select a test to view rankings."}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestAnalytics;
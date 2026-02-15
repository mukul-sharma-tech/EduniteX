import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Brain, Save, Loader2, AlertCircle, Edit3, Trash2, Plus, X } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';

const TestPage = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth(); // 2. Access the teacher's profile

  const content = state?.content || localStorage.getItem('eduassist_test_content') || '';
  const materialId = state?.materialId;
  const subjectName = state?.subject || 'General';
  const className = state?.class || 'N/A';

  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testTitle, setTestTitle] = useState(`${subjectName} Quiz`);

const prompt = `
### ROLE
You are a Senior Academic Professor and Subject Matter Expert. Your goal is to create a rigorous assessment that tests deep conceptual understanding.

### SOURCE TEXT
"""${content}"""

### TASK
Generate exactly 5 high-quality MCQs based ONLY on the technical/conceptual facts in the text.

### STRICT QUALITY RULES
1. BANNED QUESTIONS: Do not ask about the document itself (e.g., "What is the title?", "What is the syllabus about?").
2. CONCEPTUAL FOCUS: Focus on "How" and "Why" concepts.
3. DISTRACTOR LOGIC: Create 3 plausible but incorrect options.

### OUTPUT FORMAT (CRITICAL)
- Return ONLY a valid JSON array.
- Each "answer" MUST be a character-for-character identical string to one of the strings in the "options" array.

### JSON SCHEMA
[
  {
    "question": "The question text",
    "options": ["Opt A", "Opt B", "Opt C", "Opt D"],
    "answer": "Opt B" 
  }
]
`;

  useEffect(() => {
  const generateTest = async () => {
    if (!content) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3.2', 
          prompt,
          stream: false,
          options: { 
            temperature: 0.1, // Keeps it focused and consistent
            num_ctx: 4096     // Ensures enough context for longer texts
          }
        }),
      });

      const data = await res.json();
      
      // 1. EXTRACTION: Find the JSON array within the AI's response
      const startIdx = data.response.indexOf('[');
      const endIdx = data.response.lastIndexOf(']');
      
      if (startIdx === -1 || endIdx === -1) throw new Error("AI failed to provide valid JSON format");
      
      const rawJson = JSON.parse(data.response.substring(startIdx, endIdx + 1));

      // 2. SANITIZATION: Clean up extra spaces/newlines to ensure bitwise matching
      const sanitizedQuestions = rawJson.map(q => {
        // Trim the answer and all options so "Correct" matches " Correct "
        const trimmedAnswer = q.answer.trim();
        const trimmedOptions = q.options.map(opt => opt.trim());
        
        return {
          ...q,
          question: q.question.trim(),
          options: trimmedOptions,
          answer: trimmedAnswer
        };
      });

      setQuestions(sanitizedQuestions);

    } catch (err) {
      console.error('Test Generation Error:', err);
      alert('⚠️ Test generation failed. This usually happens if the AI output was interrupted or incorrectly formatted. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  generateTest();
}, [content]);

  const updateQuestion = (index, field, value) => {
    const updated = [...questions];
    updated[index][field] = value;
    setQuestions(updated);
  };

  const removeQuestion = (index) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const addBlankQuestion = () => {
    setQuestions([...questions, {
      question: "Enter your custom question here?",
      options: ["Option 1", "Option 2", "Option 3", "Option 4"],
      answer: "Option 1"
    }]);
  };

  const handleSaveTest = async () => {
    if (questions.length === 0) return;
    
    if (!profile || !profile.teacher_id) {
      alert("❌ Error: Teacher profile not found. Please log in again.");
      return;
    }

    setSaving(true);
    try {
      // 1. DYNAMIC FETCH: Ask the DB for the class of the students assigned to this teacher
      const { data: studentData, error: fetchError } = await supabase
        .from('students')
        .select('class')
        .contains('teacher_ids', [profile.teacher_id.trim()])
        .limit(1); // We just need one student to tell us the class

      if (fetchError) throw fetchError;

      // Extract the class from the database response
      const targetClass = studentData?.[0]?.class;

      if (!targetClass) {
        alert("❌ Error: You don't have any students assigned to you yet, so we cannot determine the class for this test.");
        setSaving(false);
        return;
      }

      // 2. SAVE THE TEST (No more hardcoding!)
      const { error: insertError } = await supabase.from('tests').insert([{
        teacher_id: profile.teacher_id,
        material_id: materialId || "c5298784-2054-4144-9160-30953b65fef2", 
        title: testTitle,
        subject: subjectName,
        class: targetClass, // Automatically uses the DB value (e.g., "12th Grade")
        questions: questions,
      }]);

      if (insertError) throw insertError;
      
      alert(`🚀 Success! "${testTitle}" is now live for Class ${targetClass}.`);
      // navigate('/teacher-dashboard'); 
    } catch (err) {
      alert("❌ Save Failed: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white">
      <Loader2 className="w-12 h-12 animate-spin text-blue-400 mb-4" />
      <p className="text-xl font-medium animate-pulse text-slate-400">Llama is crafting your assessment...</p>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-slate-900 pt-20 pb-24 px-6 text-white">
      <div className="max-w-3xl mx-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-blue-400 flex items-center gap-2"><Brain /> Hybrid Test Editor</h1>
          <div className="text-right">
            <span className="bg-blue-500/10 text-blue-400 px-4 py-1 rounded-full border border-blue-500/20 text-sm block">Class: {className}</span>
            <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-tighter">Teacher ID: {profile?.teacher_id}</p>
          </div>
        </div>

        {/* TEST TITLE INPUT */}
        <div className="mb-10 bg-slate-800/80 p-6 rounded-2xl border border-slate-700 shadow-xl">
          <label className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-widest mb-3"><Edit3 size={14}/> Test Name</label>
          <input 
            type="text" value={testTitle} 
            onChange={(e) => setTestTitle(e.target.value)}
            className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none text-lg font-medium"
          />
        </div>

        {/* QUESTIONS LIST */}
        <div className="space-y-8">
          {questions.map((q, index) => (
            <motion.div key={index} layout className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700 relative group shadow-lg">
              <button onClick={() => removeQuestion(index)} className="absolute -top-3 -right-3 bg-red-500 hover:bg-red-400 p-2 rounded-full text-white shadow-xl opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16}/></button>
              
              <div className="mb-6">
                <span className="text-blue-500 font-mono text-sm block mb-1">Question {index + 1}</span>
                <textarea 
                  value={q.question}
                  onChange={(e) => updateQuestion(index, 'question', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-blue-400 outline-none resize-none"
                  rows="2"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {q.options.map((opt, i) => (
                  <div key={i} className="space-y-1">
                    <input 
                      value={opt}
                      onChange={(e) => {
                        const newOpts = [...q.options];
                        newOpts[i] = e.target.value;
                        updateQuestion(index, 'options', newOpts);
                      }}
                      className={`w-full bg-slate-900 border rounded-lg px-3 py-2 text-sm outline-none transition-all ${q.answer === opt ? 'border-green-500 text-green-400' : 'border-slate-700 text-slate-400'}`}
                    />
                    <button 
                      onClick={() => updateQuestion(index, 'answer', opt)}
                      className={`text-[10px] font-bold uppercase ml-1 ${q.answer === opt ? 'text-green-500' : 'text-slate-600 hover:text-blue-400'}`}
                    >
                      {q.answer === opt ? '● Selected Correct' : '○ Set Correct'}
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}

          <button onClick={addBlankQuestion} className="w-full py-6 border-2 border-dashed border-slate-700 rounded-2xl text-slate-500 hover:border-blue-500 hover:text-blue-400 transition-all flex items-center justify-center gap-2 font-bold"><Plus size={20}/> Add Custom Question</button>
        </div>

        {/* SAVE ACTION */}
        <div className="mt-12 flex flex-col items-center">
          <button onClick={handleSaveTest} disabled={saving} className="w-full max-w-md bg-green-600 hover:bg-green-500 disabled:bg-slate-700 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-2xl transition-transform active:scale-95">
            {saving ? <Loader2 className="animate-spin" /> : <Save size={20} />}
            {saving ? "Publishing..." : "Finalize & Assign Test"}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default TestPage;
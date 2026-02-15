import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
// 👇 UPDATE THIS PATH TO MATCH YOUR SUPABASE FILE 👇
import { supabase } from '../../lib/supabaseClient';

const TestUpload = () => {
  const navigate = useNavigate();
  const [syllabusText, setSyllabusText] = useState('');
  const [pdfFile, setPdfFile] = useState(null);
  const [loading, setLoading] = useState(false);

  // 1. Fetch from Supabase (Database Option)
  // 1. Fetch from Supabase (Database Option)
  // 1. Fetch from Supabase (Database Option)
  const fetchFromDatabase = async () => {
    setLoading(true);
    try {
      // Just grab the very first entry in the subject_materials table
      const { data, error } = await supabase
        .from('subject_materials')
        .select('syllabus') 
        .limit(1)
        .maybeSingle(); 

      if (error) throw error;
      
      if (data && data.syllabus) {
        setSyllabusText(data.syllabus); 
        alert("✅ Syllabus loaded from database!");
      } else {
        alert("⚠️ Found the first entry, but the syllabus column is empty!");
      }
    } catch (err) {
      console.error(err);
      alert("❌ Failed to fetch from database.");
    } finally {
      setLoading(false);
    }
  };

  // 2. Extract from PDF (Upload Option)
  const handlePdfUpload = async () => {
    if (!pdfFile) {
      alert("Please select a PDF file first.");
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('pdf', pdfFile);
      
      // Using your existing extraction endpoint!
      const res = await axios.post('https://eduassist-nak8.onrender.com/extract-text-pdf', formData);
      const content = res.data.text?.trim();
      
      if (content) {
        setSyllabusText(content);
        alert("✅ Text extracted from PDF!");
      }
    } catch (err) {
      console.error(err);
      alert("❌ Failed to extract PDF text.");
    } finally {
      setLoading(false);
    }
  };

  // 3. Final Step: Send to AI Generator
  const handleGenerate = () => {
    if (!syllabusText.trim()) {
      alert("❌ Please provide some syllabus text first!");
      return;
    }
    
    // 1. Save the syllabus to localStorage (just like your QuizUpload does)
    localStorage.setItem('eduassist_test_content', syllabusText);
    
    // 2. Alert the user and navigate to the Quiz page
    // We are reusing your existing '/quiz' route to handle the actual generation!
    alert("🚀 Syllabus processed! Generating your test now...");
    navigate('/tests/take', { state: { content: syllabusText } });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Test Generator 📝</h1>
        
        {/* Top Controls: Database vs File */}
        <div className="flex flex-col md:flex-row gap-4 mb-6 bg-blue-50 p-4 rounded-xl border border-blue-100">
          
          {/* Database Fetch */}
          <div className="flex-1">
            <p className="text-sm font-semibold text-blue-800 mb-2">Option 1: From Database</p>
            <button 
              onClick={fetchFromDatabase}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors"
            >
              📥 Fetch Assigned Syllabus
            </button>
          </div>

          <div className="hidden md:block w-px bg-blue-200 mx-2"></div>

          {/* PDF Upload */}
          <div className="flex-1">
            <p className="text-sm font-semibold text-blue-800 mb-2">Option 2: Upload PDF</p>
            <div className="flex gap-2">
              <input 
                type="file" 
                accept="application/pdf"
                onChange={(e) => setPdfFile(e.target.files[0])}
                className="text-sm w-full file:mr-2 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200"
              />
              <button 
                onClick={handlePdfUpload}
                disabled={loading}
                className="bg-slate-800 hover:bg-slate-900 text-white font-medium py-2 px-4 rounded transition-colors"
              >
                Extract
              </button>
            </div>
          </div>
        </div>

        {/* Text Area for Review */}
        <div className="mb-6">
          <label className="block text-gray-700 font-semibold mb-2">
            Review Syllabus Content (Edit if needed):
          </label>
          <textarea 
            value={syllabusText}
            onChange={(e) => setSyllabusText(e.target.value)}
            className="w-full h-64 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
            placeholder="Your syllabus text will appear here. You can also type manually..."
          />
        </div>

        {/* Generate Button */}
        <button 
          onClick={handleGenerate}
          disabled={loading || !syllabusText}
          className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
            loading || !syllabusText 
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
            : 'bg-green-600 hover:bg-green-700 text-white shadow-md hover:shadow-lg transform hover:-translate-y-1'
          }`}
        >
          {loading ? 'Processing...' : '🚀 Generate AI Test'}
        </button>

      </div>
    </div>
  );
};

export default TestUpload;
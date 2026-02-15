import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext'; // 1. Import your auth hook

const TestHub = () => {
  const navigate = useNavigate();
  const { role } = useAuth(); // 2. Get the current user's role

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold text-gray-900 mb-8">Syllabus Tests Hub</h1>
      <p className="text-gray-500 mb-8">Select your portal below</p>

      <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full text-center flex flex-col gap-6">

        {/* 3. ONLY SHOW IF ROLE IS TEACHER */}
        {role === 'teacher' && (
          <div className="flex flex-col gap-4 w-full">
            {/* Existing Generator Card */}
            <div className="border border-blue-100 p-4 rounded-xl bg-blue-50">
              <h2 className="text-xl font-semibold text-blue-800 mb-2">Teacher View</h2>
              <p className="text-sm text-blue-600 mb-4">Fetch syllabus and generate AI tests.</p>
              <button
                onClick={() => navigate('/tests/upload')}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
              >
                Go to Generator
              </button>
            </div>

            {/* NEW: Analytics & Previous Tests Card */}
            <div className="border border-purple-100 p-4 rounded-xl bg-purple-50">
              <h2 className="text-xl font-semibold text-purple-800 mb-2">Test Analytics</h2>
              <p className="text-sm text-purple-600 mb-4">View previous tests, student rankings, and performance scores.</p>
              <button
                onClick={() => navigate('/tests/analytics')}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
              >
                View Past Results
              </button>
            </div>
          </div>
        )}

        {/* 4. ONLY SHOW IF ROLE IS STUDENT */}
        {role === 'student' && (
          <div className="border border-green-100 p-4 rounded-xl bg-green-50">
            <h2 className="text-xl font-semibold text-green-800 mb-2">Student View</h2>
            <p className="text-sm text-green-600 mb-4">View and take tests assigned to your class.</p>
            <button
              onClick={() => navigate('/tests/available')}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              Go to Available Tests
            </button>
          </div>
        )}

        {/* Fallback if somehow they have no role yet */}
        {!role && (
          <p className="text-red-500 font-semibold">Please log in to access the hub.</p>
        )}

      </div>
    </div>
  );
};

export default TestHub;
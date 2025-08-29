import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { BadgeCheck, Flame, Info, User } from "lucide-react";
import { motion } from "framer-motion";

const StudentDashboard = () => {
  const [traits, setTraits] = useState({ strengths: [], weaknesses: [] });
  const [student, setStudent] = useState(null);
  const navigate = useNavigate();

  const email = localStorage.getItem("eduassist_user_email");


  const [meetings, setMeetings] = useState([]);

useEffect(() => {
  if (!student?.id) return;

  const fetchMeetings = async () => {
    const { data, error } = await supabase
      .from("meetings")
      .select("meeting_id, subject, teacher_name, students_doubts, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching meetings:", error);
    } else {
      // Filter only meetings where this student's ID appears in doubts
      const filtered = data.filter(meeting => {
        return meeting.students_doubts?.some(
          d => d.student_id === student.id
        );
      });
      setMeetings(filtered);
    }
  };

  fetchMeetings();
}, [student]);

  useEffect(() => {
    const fetchStudentData = async () => {
      if (!email) return;

      // 🔍 Fetch student full info
      const { data: studentData, error } = await supabase
        .from("students")
        .select("id, name, email, phone, class, roll_no, teacher_ids, created_at")
        .eq("email", email)
        .single();

      if (error) {
        console.error("❌ Error fetching student:", error);
        return;
      }

      setStudent(studentData);

      // 🔍 Fetch traits
      const { data: traitsData, error: traitsError } = await supabase
        .from("student_traits")
        .select("strengths, weaknesses")
        .eq("student_id", studentData.id)
        .single();

      if (traitsError) {
        console.error("❌ Error fetching traits:", traitsError);
        return;
      }

      setTraits({
        strengths: traitsData?.strengths || [],
        weaknesses: traitsData?.weaknesses || [],
      });
    };

    fetchStudentData();
  }, [email]);

  const handleWeaknessQuiz = () => {
    const weaknessTopics = traits.weaknesses.join(". ");
    navigate("/quiz-generate", { state: { autoFillContent: weaknessTopics } });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen bg-gradient-to-br from-blue-50 to-white text-gray-900 px-6 my-3 py-16"
    >
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center">
          Welcome, <span className="text-blue-600">{student?.name || "Student"}</span>
        </h1>

        {/* 📋 Full Student Info */}
        <div className="bg-white/70 border border-blue-200 shadow rounded-lg p-6 mb-10">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-blue-700">
            <User size={20} /> Your Profile
          </h2>
          <ul className="text-sm space-y-2 text-gray-700">
            <li><strong>Email:</strong> {student?.email || "—"}</li>
            <li><strong>Phone:</strong> {student?.phone || "—"}</li>
            <li><strong>Class:</strong> {student?.class || "—"}</li>
            <li><strong>Roll No:</strong> {student?.roll_no || "—"}</li>
            <li><strong>Registered On:</strong> {student?.created_at?.split("T")[0] || "—"}</li>
            <li>
              <strong>Assigned Teachers:</strong>{" "}
              {student?.teacher_ids?.length ? student.teacher_ids.join(", ") : "—"}
            </li>
          </ul>
        </div>

        {/* ✅ Strengths */}
        <div className="mb-10">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <BadgeCheck className="text-green-500" /> Strengths
          </h2>
          {traits.strengths.length ? (
            <ul className="list-disc ml-6 space-y-1">
              {traits.strengths.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-600">No strengths data found yet.</p>
          )}
        </div>

        {/* 🔥 Weaknesses */}
        <div>
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <Flame className="text-red-500" /> Weaknesses
          </h2>
          {traits.weaknesses.length ? (
            <>
              <ul className="list-disc ml-6 space-y-1">
                {traits.weaknesses.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
              <button
                onClick={handleWeaknessQuiz}
                className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow"
              >
                Work on Your Weaknesses
              </button>
            </>
          ) : (
            <p className="text-gray-600">No weaknesses recorded yet.</p>
          )}
        </div>
        {/* 📝 Meetings & Doubts */}
<div className="mt-10">
  <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2 text-purple-600">
    <Info className="text-purple-500" /> Your Doubts in Meetings
  </h2>
  {meetings.length ? (
    meetings.map((meeting) => {
      const studentDoubts = meeting.students_doubts.filter(
        d => d.student_id === student.id
      );

      return (
        <div
          key={meeting.meeting_id}
          className="bg-white/70 border border-purple-200 shadow rounded-lg p-4 mb-4"
        >
          <h3 className="text-lg font-bold text-purple-700">
            {meeting.subject}
          </h3>
          <p className="text-sm text-gray-600 mb-2">
            Teacher: {meeting.teacher_name} | {new Date(meeting.created_at).toLocaleString()}
          </p>
          <ul className="list-disc ml-6 text-gray-800">
            {studentDoubts.map((d, i) => (
              <li key={i}>
                <strong>Doubt:</strong> {d.doubt} <br />
                <strong>Solution:</strong> {d.solve || "Not answered yet"}
              </li>
            ))}
          </ul>
        </div>
      );
    })
  ) : (
    <p className="text-gray-600">No doubts recorded in your meetings yet.</p>
  )}
</div>

      </div>
    </motion.div>
  );
};

export default StudentDashboard;

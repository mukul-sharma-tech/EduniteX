// import { useEffect, useState } from "react";
// import { supabase } from "../lib/supabaseClient";
// import axios from "axios";

// const TeacherDashboard = () => {
//   const [teacherId, setTeacherId] = useState("");
//   const [authId, setAuthId] = useState("");

//   const [subject, setSubject] = useState("");
//   const [className, setClassName] = useState("");
//   const [syllabusPDF, setSyllabusPDF] = useState(null);
//   const [notesPDF, setNotesPDF] = useState(null);
//   const [extractedSyllabus, setExtractedSyllabus] = useState("");

//   // Load IDs
//   useEffect(() => {
//     const storedTeacherId = localStorage.getItem("eduassist_teacher_id");
//     if (storedTeacherId) setTeacherId(storedTeacherId);

//     supabase.auth.getUser().then((res) => {
//       if (res.data?.user?.id) setAuthId(res.data.user.id);
//     });
//   }, []);

//   // Upload notes PDF to Supabase Storage
//   const uploadNotesPDF = async (file) => {
//     const fileName = `notes/${Date.now()}-${file.name}`;
//     const { error } = await supabase.storage
//       .from("materials")
//       .upload(fileName, file);

//     if (error) throw error;

//     const { data } = supabase.storage
//       .from("materials")
//       .getPublicUrl(fileName);

//     return data.publicUrl;
//   };

//   // Handle full form submission
// const handleUpload = async () => {
//   if (!subject || !className || !syllabusPDF || !notesPDF)
//     return alert("Please fill all fields and upload both PDFs.");

//   try {
//     // 1. Extract text from syllabus PDF
//     const syllabusForm = new FormData();
//     syllabusForm.append("pdf", syllabusPDF);
//     const syllabusRes = await axios.post(
//       "http://localhost:5000/extract-text-pdf",
//       syllabusForm
//     );
//     const syllabusText = syllabusRes.data.text;
//     setExtractedSyllabus(syllabusText);

//     // 2. Extract text from notes PDF
//     const notesForm = new FormData();
//     notesForm.append("pdf", notesPDF);
//     const notesRes = await axios.post(
//       "http://localhost:5000/extract-text-pdf",
//       notesForm
//     );
//     const notesText = notesRes.data.text;

//     // 3. Save to Supabase DB
//     const { error } = await supabase.from("subject_materials").insert([
//       {
//         subject,
//         class: className,
//         syllabus: syllabusText,
//         notes: [notesText], // Stored as array of extracted text(s)
//         policy: "Public",
//         teacher_id: teacherId,
//         auth_id: authId,
//       },
//     ]);

//     if (error) throw error;
//     alert("✅ Materials uploaded and extracted successfully!");
//   } catch (err) {
//     console.error("❌ Upload failed:", err.message);
//     alert("Failed to upload or extract materials.");
//   }
// };

//   return (
//     <div className="p-6 max-w-4xl mx-auto">
//       <h2 className="text-3xl font-bold mb-6 text-purple-800">Teacher Dashboard</h2>

//       {/* Upload Form */}
//       <div className="bg-white p-6 rounded shadow">
//         <h3 className="text-xl font-semibold mb-4">Upload Syllabus & Notes (PDF)</h3>

//         <input
//           type="text"
//           placeholder="Subject"
//           value={subject}
//           onChange={(e) => setSubject(e.target.value)}
//           className="border px-4 py-2 rounded w-full mb-3"
//         />
//         <input
//           type="text"
//           placeholder="Class"
//           value={className}
//           onChange={(e) => setClassName(e.target.value)}
//           className="border px-4 py-2 rounded w-full mb-3"
//         />

//         <label className="font-medium block mb-1">Syllabus PDF</label>
//         <input
//           type="file"
//           accept="application/pdf"
//           onChange={(e) => setSyllabusPDF(e.target.files[0])}
//           className="mb-4"
//         />

//         <label className="font-medium block mb-1">Notes PDF</label>
//         <input
//           type="file"
//           accept="application/pdf"
//           onChange={(e) => setNotesPDF(e.target.files[0])}
//           className="mb-6"
//         />

//         <button
//           onClick={handleUpload}
//           className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
//         >
//           Upload & Save Materials
//         </button>

//         {/* {extractedSyllabus && (
//           <div className="mt-6 p-4 bg-gray-100 border rounded">
//             <h4 className="font-semibold mb-2">Extracted Syllabus Text:</h4>
//             <pre className="whitespace-pre-wrap text-sm">{extractedSyllabus}</pre>
//           </div>
//         )} */}
//       </div>
//     </div>
//   );
// };

// export default TeacherDashboard;



import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import axios from "axios";

const TeacherDashboard = () => {
  const [teacherId, setTeacherId] = useState("");
  const [authId, setAuthId] = useState("");

  const [subject, setSubject] = useState("");
  const [className, setClassName] = useState("");
  const [syllabusPDF, setSyllabusPDF] = useState(null);
  const [notesPDF, setNotesPDF] = useState(null);
  const [extractedSyllabus, setExtractedSyllabus] = useState("");
  const [meetings, setMeetings] = useState([]);
  const [teacherDetails, setTeacherDetails] = useState({}); 

  const [students, setStudents] = useState([]);
  useEffect(() => {
  const storedTeacherId = localStorage.getItem("eduassist_teacher_id");

  supabase.auth.getUser().then(async (res) => {
    if (res.data?.user?.id) {
      setAuthId(res.data.user.id);

      // Fetch teacher record to get both id & teacher_id
      const { data: teacherData, error } = await supabase
        .from("teachers")
        // .select("id, teacher_id, name, email") // include details to display

              .select("id, teacher_id, name, email, phone, subjects") // added phone & subjects

        .eq("auth_id", res.data.user.id)
        .single();

      if (error) {
        console.error("Error fetching teacher:", error);
      } else {
        const correctTeacherId = teacherData?.teacher_id || storedTeacherId;
        const teacherRecordId = teacherData?.id;

        setTeacherId(correctTeacherId?.trim());
        setTeacherDetails({
          id: teacherRecordId,
          name: teacherData?.name,
          email: teacherData?.email,
          phone: teacherData?.phone, // added phone
          subjects: teacherData?.subjects // added subjects
        });
      }
    }
  });
}, []);


  useEffect(() => {
    if (teacherId) {
      fetchStudents(teacherId);
      console.log("Fetching students for Teacher ID:", teacherId);
    }
  }, [teacherId]);


  useEffect(() => {
    const fetchTeacherDetails = async () => {
      if (!teacherId) return;
      const { data, error } = await supabase
        .from("teachers")
        .select("name, email, subject, class")
        .eq("teacher_id", teacherId)
        .single();

      if (error) {
        console.error("Error fetching teacher details:", error.message);
      } else {
        setTeacherDetails(data);
      }
    };

    fetchTeacherDetails();
  }, [teacherId]);

  const fetchStudents = async (tId) => {
    const { data, error } = await supabase
      .from("students")
      .select("*")
      .contains("teacher_ids", [tId.trim()]); // filter by teacher ID

    console.log("Filtered students:", data);

    if (error) {
      console.error("Error fetching students:", error.message);
    } else {
      setStudents(data);
    }
  };




  const fetchMeetings = async (teacherId) => {
    const { data, error } = await supabase
      .from("meetings")
      .select("*")
      .eq("teacher_id", teacherId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching meetings:", error);
      return [];
    }

    return data;
  };


  const parseDoubts = (meetings) => {
    return meetings.map((meeting) => ({
      ...meeting,
      students_doubts: meeting.students_doubts || [],
      total_doubts: meeting.students_doubts?.length || 0,
    }));
  };
  useEffect(() => {
    if (teacherId) {
      fetchMeetings(teacherId).then((res) => {
        setMeetings(parseDoubts(res));
      });
    }
  }, [teacherId]);




  // Handle form submission for uploading syllabus and notes
  const handleUpload = async () => {
    if (!subject || !className || !syllabusPDF || !notesPDF)
      return alert("Please fill all fields and upload both PDFs.");

    try {
      // 1. Extract text from syllabus PDF
      const syllabusForm = new FormData();
      syllabusForm.append("pdf", syllabusPDF);
      const syllabusRes = await axios.post(
        "http://localhost:5000/extract-text-pdf",
        syllabusForm
      );
      const syllabusText = syllabusRes.data.text;
      setExtractedSyllabus(syllabusText);

      // 2. Extract text from notes PDF
      const notesForm = new FormData();
      notesForm.append("pdf", notesPDF);
      const notesRes = await axios.post(
        "http://localhost:5000/extract-text-pdf",
        notesForm
      );
      const notesText = notesRes.data.text;

      // 3. Save to Supabase DB
      const { error } = await supabase.from("subject_materials").insert([
        {
          subject,
          class: className,
          syllabus: syllabusText,
          notes: [notesText], // stored as array
          policy: "Public",
          teacher_id: teacherId,
          auth_id: authId,
        },
      ]);

      if (error) throw error;
      alert("✅ Materials uploaded and extracted successfully!");
    } catch (err) {
      console.error("❌ Upload failed:", err.message);
      alert("Failed to upload or extract materials.");
    }
  };


  const handleSolve = async (meetingId, doubtIndex, solution) => {
  // Update UI immediately
  setMeetings((prev) =>
    prev.map((meeting) =>
      meeting.meeting_id === meetingId
        ? {
            ...meeting,
            students_doubts: meeting.students_doubts.map((d, i) =>
              i === doubtIndex ? { ...d, solve: solution } : d
            ),
          }
        : meeting
    )
  );

  // Get the updated meeting from state
  const updatedMeeting = meetings.find((m) => m.meeting_id === meetingId);
  if (!updatedMeeting) return;

  // Update doubts array with new solution
  const updatedDoubts = updatedMeeting.students_doubts.map((d, i) =>
    i === doubtIndex ? { ...d, solve: solution } : d
  );

  // Save to Supabase
  const { error } = await supabase
    .from("meetings")
    .update({ students_doubts: updatedDoubts })
    .eq("meeting_id", meetingId);

  if (error) {
    console.error("Error updating solve:", error.message);
  } else {
    console.log("Solution saved successfully!");
  }
};


  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h2 className="text-3xl font-bold mb-6 text-purple-800">
        Teacher Dashboard
      </h2>

         {/* Teacher Info Card */}
      {teacherDetails && (
        <div className="bg-gray-100 p-4 rounded-lg shadow-md mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Teacher Dashboard
          </h2>
          <p><strong>Name:</strong> {teacherDetails.name}</p>
          <p><strong>Email:</strong> {teacherDetails.email}</p>
    <p><strong>Phone:</strong> {teacherDetails.phone}</p>
    <p><strong>Subjects:</strong> {teacherDetails.subjects?.join(", ")}</p>
        </div>
      )}

      {/* Upload Form */}
      <div className="bg-white p-6 rounded shadow mb-8">
        <h3 className="text-xl font-semibold mb-4">
          Upload Syllabus & Notes (PDF)
        </h3>

        <input
          type="text"
          placeholder="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="border px-4 py-2 rounded w-full mb-3"
        />
        <input
          type="text"
          placeholder="Class"
          value={className}
          onChange={(e) => setClassName(e.target.value)}
          className="border px-4 py-2 rounded w-full mb-3"
        />

        <label className="font-medium block mb-1">Syllabus PDF</label>
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setSyllabusPDF(e.target.files[0])}
          className="mb-4"
        />

        <label className="font-medium block mb-1">Notes PDF</label>
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setNotesPDF(e.target.files[0])}
          className="mb-6"
        />

        <button
          onClick={handleUpload}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          Upload & Save Materials
        </button>
      </div>

      {/* Display Students */}
      <div className="bg-white p-6 rounded shadow">
        <h3 className="text-xl font-semibold mb-4">Assigned Students</h3>
        {students.length > 0 ? (
          <table className="w-full border">
            <thead>
              <tr className="bg-gray-200">
                <th className="p-2 border">Name</th>
                <th className="p-2 border">Email</th>
                <th className="p-2 border">Class</th>
                <th className="p-2 border">Roll No</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id}>
                  <td className="p-2 border">{student.name}</td>
                  <td className="p-2 border">{student.email}</td>
                  <td className="p-2 border">{student.class}</td>
                  <td className="p-2 border">{student.roll_no}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No students assigned to you.</p>
        )}
      </div>

      <div>
        <h2 className="text-xl font-bold mb-4">Meetings & Doubts</h2>
        {meetings
          .filter((meeting) => meeting.total_doubts > 0)
          .map((meeting) => (
            <div key={meeting.meeting_id} className="border p-4 rounded mb-4 shadow-sm">
              <h3 className="font-semibold text-lg mb-2">{meeting.subject}</h3>
              <p className="mb-1"><strong>Teacher:</strong> {meeting.teacher_name}</p>
              <p className="mb-3"><strong>Total Doubts:</strong> {meeting.total_doubts}</p>

              <table className="table-auto w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border p-2 text-left">Student Name</th>
                    <th className="border p-2 text-left">Doubt</th>
                    <th className="border p-2 text-left">Solution</th>
                  </tr>
                </thead>
                <tbody>
                  {meeting.students_doubts.map((d, i) => (
                    <tr key={i} className="border-b">
                      <td className="border p-2">{d.student_name}</td>
                      <td className="border p-2">{d.doubt}</td>
                      <td className="border p-2">
                        {d.solve ? (
                          <span>{d.solve}</span>
                        ) : (
                          <input
                            type="text"
                            placeholder="Enter solution"
                            className="border rounded p-1 w-full"
                            onBlur={(e) => handleSolve(meeting.meeting_id, i, e.target.value)}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
      </div>

    </div>
  );
};

export default TeacherDashboard;

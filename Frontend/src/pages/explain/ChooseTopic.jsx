import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Moon, Sun, ChevronRight, Upload, BookText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ChooseTopic() {

  const [darkMode, setDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState('text');
  const [topicText, setTopicText] = useState('');
  const [story, setStory] = useState('');
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState('english');

  const navigate = useNavigate();


  // ✅ CLEAN TEXT
  const cleanText = (text) => {
    return text
      .replace(/[^\w\s.,?!]/g, '') // remove special chars
      .replace(/\s+/g, ' ')
      .trim();
  };


  // ✅ CALL OLLAMA
  const callOllama = async (prompt) => {

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

    if (!res.ok) {
      throw new Error('Ollama API failed');
    }

    const data = await res.json();

    return data.response;
  };


  // ✅ GENERATE STORY
  const handleGenerateStory = async (text) => {

    setLoading(true);

    try {

      const prompt = `
Explain the following topic in a simple, engaging, and story-like format for beginners: and dont just make it only story. keep the topic explaination also. It should be blend of story based and real topic. like 80% proper topic and 20% blend of topic to explain and relate to real world

"${text}"


Rules:
- Keep the response SHORT and concise.
- Use friendly storytelling with examples with technical and subject keywords too and dont go too much in story.
- Make it feel like a human is explaining naturally.
- Translate and narrate in ${language} language.
- Do NOT use any special symbols like #, *, -, _, @, emojis, or markdown.
- Do NOT use bullet points.
- Write in plain text only.
- No headings.
- No formatting.
- No extra spacing.
- Make it feel natural and human.
- Keep it short
- No special symbols
- No emojis
- No markdown
- Plain text only
- Natural human tone
`;

      const aiOutput = await callOllama(prompt);

      const cleaned = cleanText(aiOutput);

      setStory(cleaned);

    } catch (err) {

      console.error(err);
      alert('AI generation failed');

    } finally {

      setLoading(false);

    }
  };


  // ✅ TEXT SUBMIT
  const handleTextSubmit = () => {

    if (!topicText.trim()) return;

    handleGenerateStory(topicText.trim());
  };


  // ✅ PDF UPLOAD
  const handleUploadPdf = async (e) => {

    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);

    try {

      const formData = new FormData();
      formData.append('pdf', file);

      const response = await fetch(
        'https://eduassist-nak8.onrender.com/extract-text-pdf',
        {
          method: 'POST',
          body: formData,
        }
      );

      const data = await response.json();

      const extractedText = data?.text || '';

      setTopicText(extractedText);

      if (extractedText) {

        await handleGenerateStory(extractedText);

      } else {

        alert('No text found in PDF');

      }

    } catch (err) {

      console.error(err);
      alert('PDF upload failed');

    } finally {

      setLoading(false);

    }
  };


  // ✅ NEXT PAGE
  const handleProceed = () => {

    if (!story) return;

    navigate('/story', {
      state: { topic: topicText, story, language },
    });
  };


  return (

    <div className="bg-slate-900 min-h-screen">

      <div className="max-w-4xl mt-16 mx-auto px-4 py-10">


        {/* HEADER */}
        <motion.div
          className="flex justify-between items-center mb-8"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >

          <h1 className="text-3xl font-bold text-blue-500">
            Topic Story Generator
          </h1>

        </motion.div>


        {/* LANGUAGE */}
        <div className="mb-6">

          <label className="text-white mr-3">
            Language:
          </label>

          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="px-3 py-1 rounded"
          >

            <option value="english">English</option>
            <option value="hindi">Hindi</option>
            <option value="hinglish">Hinglish</option>

          </select>

        </div>


        {/* TABS */}
        <div className="flex mb-6 border-b">

          <button
            onClick={() => setActiveTab('text')}
            className={`px-4 py-2 ${
              activeTab === 'text'
                ? 'text-blue-500 border-b-2 border-blue-500'
                : 'text-gray-400'
            }`}
          >

            <BookText className="inline mr-2 w-4 h-4" />
            Enter Topic

          </button>


          <button
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-2 ${
              activeTab === 'upload'
                ? 'text-blue-500 border-b-2 border-blue-500'
                : 'text-gray-400'
            }`}
          >

            <Upload className="inline mr-2 w-4 h-4" />
            Upload PDF

          </button>

        </div>


        {/* INPUT */}
        <AnimatePresence>

          {activeTab === 'text' ? (

            <motion.div>

              <textarea
                className="w-full p-4 rounded bg-white text-black"
                placeholder="Enter topic..."
                value={topicText}
                onChange={(e) => setTopicText(e.target.value)}
              />


              <button
                onClick={handleTextSubmit}
                disabled={loading}
                className="mt-4 bg-blue-600 px-6 py-2 rounded text-white"
              >

                {loading ? 'Generating...' : 'Generate'}

              </button>

            </motion.div>

          ) : (

            <motion.div>

              <div className="p-6 border-dashed border-2 rounded text-center text-white">

                <Upload className="mx-auto mb-2" />

                <label className="cursor-pointer">

                  Upload PDF

                  <input
                    type="file"
                    hidden
                    accept=".pdf"
                    onChange={handleUploadPdf}
                  />

                </label>

              </div>

            </motion.div>

          )}

        </AnimatePresence>


        {/* OUTPUT */}
        {story && (

          <motion.div
            className="mt-8 p-6 bg-white rounded text-black"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >

            <h2 className="font-bold mb-3">
              Generated Story
            </h2>

            <p>{story}</p>


            <button
              onClick={handleProceed}
              className="mt-4 bg-blue-600 px-5 py-2 text-white rounded flex items-center gap-2 ml-auto"
            >

              Proceed
              <ChevronRight size={18} />

            </button>

          </motion.div>

        )}

      </div>

    </div>
  );
}

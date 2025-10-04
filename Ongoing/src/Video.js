import React, { Component } from "react";
import io from "socket.io-client";
import faker from "faker";
import { Autocomplete, TextField, CircularProgress, Typography, ToggleButtonGroup, ToggleButton, MenuItem, IconButton, Badge, Input, Button } from '@mui/material';
import { supabase } from "./supabaseClient";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import ScreenShareIcon from "@mui/icons-material/ScreenShare";
import StopScreenShareIcon from "@mui/icons-material/StopScreenShare";
import CallEndIcon from "@mui/icons-material/CallEnd";
import ChatIcon from "@mui/icons-material/Chat";
import PushPinIcon from "@mui/icons-material/PushPin";
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

import { message } from "antd";

import { Row } from "reactstrap";
import Modal from "react-bootstrap/Modal";
import "bootstrap/dist/css/bootstrap.css";
import "./Video.css"; // Import the new CSS file

const server_url =
  process.env.NODE_ENV === "production" ? "" : "http://localhost:4001";

var connections = {};
const peerConnectionConfig = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    {
      urls: "turn:relay.metered.ca:80",
      username: "openai",
      credential: "openai",
    },
  ],
};
var socket = null;
var socketId = null;

class Video extends Component {
  constructor(props) {
    super(props);
    this.localVideoref = React.createRef();
    this.videoAvailable = false;
    this.audioAvailable = false;

    this.state = {
      // --- All your existing state from before ---
      video: false, audio: false, screen: false, showModal: false, screenAvailable: false,
      messages: [], message: "", newmessages: 0, usernames: {}, streams: {}, pinnedId: null,
      askForUsername: true, username: '', userRole: null, selectedUserDetails: null,
      searchOptions: [], loading: false, availableSubjects: [], selectedSubject: '',

      // --- NEW STATE FOR CONFUSION TRACKER ---
      analysisIntervalId: null, // To hold the setInterval ID (student-side old loop)
      showConfusionModal: false,
      confusionDoubtText: '',
      meetingId: null, // To store the ID of the current meeting
      // --- NEW: teacher-side per-student confusion map ---
      confusionBySocketId: {}, // { [socketId]: { label: 'Confused'|'Not Confused'|'No Face', mainEmotion?: string, ts: number } }
      // --- NEW STATE FOR AI SOLUTION ---
      showAISolutionModal: false,
      aiSolution: '',
      originalDoubt: '',
      // --- NEW STATE FOR DOUBT NOTIFICATIONS ---
      doubtNotifications: {}, // { [socketId]: boolean }
    };

    this.canvasRef = React.createRef(); // Add a ref for our hidden canvas
    this.remoteVideoRefs = {};
    this.remoteAnalysisIntervals = {}; // { socketId: intervalId }
    this.debounceTimeout = null;

    // --- All method bindings ---
    this.handleSubjectChange = this.handleSubjectChange.bind(this);
    this.handleRoleChange = this.handleRoleChange.bind(this);
    this.handleNameSearch = this.handleNameSearch.bind(this);
    this.handleUsernameSelection = this.handleUsernameSelection.bind(this);
    connections = {};
  }

  componentDidMount() {
    this.getPermissions();
    this.fetchAvailableSubjects();
  }

  componentWillUnmount() {
    // Clean up the analysis loop when the component is removed
    this.stopAnalysis();
    // Clear teacher-side per-stream intervals
    Object.values(this.remoteAnalysisIntervals).forEach((id) => clearInterval(id));
    this.remoteAnalysisIntervals = {};
  }

  getPermissions = async () => {
    try {
      await navigator.mediaDevices
        .getUserMedia({ video: true })
        .then(() => (this.videoAvailable = true))
        .catch(() => (this.videoAvailable = false));

      await navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then(() => (this.audioAvailable = true))
        .catch(() => (this.audioAvailable = false));

      if (navigator.mediaDevices.getDisplayMedia) {
        this.setState({ screenAvailable: true });
      } else {
        this.setState({ screenAvailable: false });
      }

      if (this.videoAvailable || this.audioAvailable) {
        navigator.mediaDevices
          .getUserMedia({
            video: this.videoAvailable,
            audio: this.audioAvailable,
          })
          .then((stream) => {
            window.localStream = stream;
            this.localVideoref.current.srcObject = stream;
          })
          .catch((e) => console.log(e));
      }
    } catch (e) {
      console.log(e);
    }
  };

  subject
  fetchAvailableSubjects = async () => {
    try {
      const { data, error } = await supabase.from('teachers').select('subjects');
      if (error) throw error;

      const allSubjectArrays = data.map(teacher => teacher.subjects).filter(Boolean);
      const flattenedSubjects = [].concat(...allSubjectArrays);
      const uniqueSubjects = [...new Set(flattenedSubjects)];

      this.setState({ availableSubjects: uniqueSubjects.sort() });

    } catch (error) {
      console.error("Error fetching subjects:", error.message);
      message.error("Could not load subject list.");
    }
  }

  handleSubjectChange = (event) => {
    this.setState({
      selectedSubject: event.target.value,
      username: '',
      selectedUserDetails: null,
      searchOptions: [],
    });
  };

  handleTeacherSearch = (searchText) => {
    // Clear the previous timeout to debounce the input
    clearTimeout(this.debounceTimeout);

    // If the search text is empty, don't search
    if (!searchText) {
      this.setState({ teacherOptions: [] });
      return;
    }

    this.setState({ loading: true });

    // Set a new timeout
    this.debounceTimeout = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from('teachers')
          .select('name')
          .ilike('name', `%${searchText}%`) // Case-insensitive search
          .limit(10); // Limit results for performance

        if (error) {
          throw error;
        }

        // The Autocomplete component expects an array of strings
        const teacherNames = data ? data.map(teacher => teacher.name) : [];
        this.setState({ teacherOptions: teacherNames });

      } catch (error) {
        console.error('Error fetching teachers:', error.message);
        message.error("Could not fetch teachers."); // Notify the user
      } finally {
        this.setState({ loading: false });
      }
    }, 500); // Wait 500ms after the user stops typing
  }

  // handleNameSearch = (searchText) => {
  //   clearTimeout(this.debounceTimeout);
  //   if (!searchText) {
  //     this.setState({ searchOptions: [] });
  //     return;
  //   }
  //   this.setState({ loading: true });

  //   this.debounceTimeout = setTimeout(async () => {
  //     const { userRole, selectedSubject } = this.state;
  //     if (!userRole || !selectedSubject) {
  //       this.setState({ loading: false });
  //       return;
  //     }

  //     const tableName = userRole === 'teacher' ? 'teachers' : 'students';

  //     try {
  //       let query = supabase
  //         .from(tableName)
  //         .select('*')
  //         .ilike('name', `%${searchText}%`);

  //       // NEW: Filter teachers by the selected subject
  //       if (userRole === 'teacher') {
  //         query = query.contains('subjects', [selectedSubject]);
  //       }

  //       const { data, error } = await query.limit(10);
  //       if (error) throw error;
  //       this.setState({ searchOptions: data || [] });

  //     } catch (error) {
  //       console.error(`Error fetching from ${tableName}:`, error.message);
  //       message.error(`Could not fetch ${tableName}.`);
  //     } finally {
  //       this.setState({ loading: false });
  //     }
  //   }, 500);
  // }

  handleNameSearch = (searchText) => {
    clearTimeout(this.debounceTimeout);
    if (!searchText) {
      this.setState({ searchOptions: [] });
      return;
    }
    this.setState({ loading: true });

    this.debounceTimeout = setTimeout(async () => {
      const { userRole, selectedSubject } = this.state;

      // --- CORRECTED VALIDATION ---
      // 1. We must have a role to continue.
      if (!userRole) {
        this.setState({ loading: false });
        return;
      }
      // 2. If the user is a teacher, they MUST have selected a subject.
      //    This check is skipped for students.
      if (userRole === 'teacher' && !selectedSubject) {
        this.setState({ loading: false });
        return;
      }
      // --- END CORRECTION ---

      const tableName = userRole === 'teacher' ? 'teachers' : 'students';

      try {
        let query = supabase
          .from(tableName)
          .select('*')
          .ilike('name', `%${searchText}%`);

        // This part is already correct: only filter for teachers
        if (userRole === 'teacher') {
          query = query.contains('subjects', [selectedSubject]);
        }

        const { data, error } = await query.limit(10);
        if (error) throw error;
        this.setState({ searchOptions: data || [] });

      } catch (error) {
        console.error(`Error fetching from ${tableName}:`, error.message);
        message.error(`Could not fetch ${tableName}.`);
      } finally {
        this.setState({ loading: false });
      }
    }, 500);
  }


  // Add this new method to handle the role change
  handleRoleChange = (event, newRole) => {
    if (newRole !== null) {
      this.setState({
        userRole: newRole,
        username: '', // Clear username when role changes
        searchOptions: [], // Clear previous search options
      });
    }
  };

  handleUsernameSelection = (selectedObject) => {
    this.setState({
      // Store the entire object (or null if cleared)
      selectedUserDetails: selectedObject,
      // Store just the name for display and other parts of the app
      username: selectedObject ? selectedObject.name : '',
    });
  };

  getMedia = () => {
    this.setState(
      {
        video: this.videoAvailable,
        audio: this.audioAvailable,
      },
      () => {
        this.getUserMedia();
        this.connectToSocketServer();
      }
    );
  };

  getUserMedia = () => {
    if (
      (this.state.video && this.videoAvailable) ||
      (this.state.audio && this.audioAvailable)
    ) {
      navigator.mediaDevices
        .getUserMedia({ video: this.state.video, audio: this.state.audio })
        .then(this.getUserMediaSuccess)
        .catch((e) => console.log(e));
    } else {
      try {
        let tracks = this.localVideoref.current.srcObject.getTracks();
        tracks.forEach((track) => track.stop());
      } catch (e) { }
    }
  };

  getUserMediaSuccess = (stream) => {
    try {
      window.localStream.getTracks().forEach((track) => track.stop());
    } catch (e) { console.log(e); }

    window.localStream = stream;
    this.localVideoref.current.srcObject = stream;

    for (let id in connections) {
      if (id === socketId) continue;
      connections[id].addStream(window.localStream);
      connections[id].createOffer().then((description) => {
        connections[id].setLocalDescription(description)
          .then(() => {
            socket.emit("signal", id, JSON.stringify({ sdp: connections[id].localDescription }));
          })
          .catch((e) => console.log(e));
      });
    }

    stream.getTracks().forEach(
      (track) =>
      (track.onended = () => {
        this.setState({ video: false, audio: false, }, () => {
          try {
            let tracks = this.localVideoref.current.srcObject.getTracks();
            tracks.forEach((track) => track.stop());
          } catch (e) { console.log(e); }

          let blackSilence = (...args) => new MediaStream([this.black(...args), this.silence()]);
          window.localStream = blackSilence();
          this.localVideoref.current.srcObject = window.localStream;

          for (let id in connections) {
            connections[id].addStream(window.localStream);
            connections[id].createOffer().then((description) => {
              connections[id].setLocalDescription(description)
                .then(() => {
                  socket.emit("signal", id, JSON.stringify({ sdp: connections[id].localDescription }));
                })
                .catch((e) => console.log(e));
            });
          }
        }
        );
      })
    );
  };

  getDislayMedia = () => {
    if (this.state.screen) {
      if (navigator.mediaDevices.getDisplayMedia) {
        navigator.mediaDevices
          .getDisplayMedia({ video: true, audio: true })
          .then(this.getDislayMediaSuccess)
          .catch((e) => console.log(e));
      }
    }
  };

  getDislayMediaSuccess = (stream) => {
    try {
      window.localStream.getTracks().forEach((track) => track.stop());
    } catch (e) { console.log(e); }

    window.localStream = stream;
    this.localVideoref.current.srcObject = stream;

    for (let id in connections) {
      if (id === socketId) continue;
      connections[id].addStream(window.localStream);
      connections[id].createOffer().then((description) => {
        connections[id].setLocalDescription(description)
          .then(() => {
            socket.emit("signal", id, JSON.stringify({ sdp: connections[id].localDescription }));
          })
          .catch((e) => console.log(e));
      });
    }

    stream.getTracks().forEach(
      (track) =>
      (track.onended = () => {
        this.setState({ screen: false }, () => {
          try {
            let tracks = this.localVideoref.current.srcObject.getTracks();
            tracks.forEach((track) => track.stop());
          } catch (e) { console.log(e); }

          let blackSilence = (...args) => new MediaStream([this.black(...args), this.silence()]);
          window.localStream = blackSilence();
          this.localVideoref.current.srcObject = window.localStream;
          this.getUserMedia();
        }
        );
      })
    );
  };

  gotMessageFromServer = (fromId, message) => {
    var signal = JSON.parse(message);
    if (fromId !== socketId) {
      if (signal.sdp) {
        connections[fromId].setRemoteDescription(new RTCSessionDescription(signal.sdp))
          .then(() => {
            if (signal.sdp.type === "offer") {
              connections[fromId].createAnswer()
                .then((description) => {
                  connections[fromId].setLocalDescription(description)
                    .then(() => {
                      socket.emit("signal", fromId, JSON.stringify({ sdp: connections[fromId].localDescription }));
                    })
                    .catch((e) => console.log(e));
                })
                .catch((e) => console.log(e));
            }
          })
          .catch((e) => console.log(e));
      }

      if (signal.ice) {
        connections[fromId].addIceCandidate(new RTCIceCandidate(signal.ice))
          .catch((e) => console.log(e));
      }
    }
  };

  silence = () => {
    let ctx = new AudioContext();
    let oscillator = ctx.createOscillator();
    let dst = oscillator.connect(ctx.createMediaStreamDestination());
    oscillator.start();
    ctx.resume();
    return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false });
  };

  black = ({ width = 640, height = 480 } = {}) => {
    let canvas = Object.assign(document.createElement("canvas"), { width, height });
    canvas.getContext("2d").fillRect(0, 0, width, height);
    let stream = canvas.captureStream();
    return Object.assign(stream.getVideoTracks()[0], { enabled: false });
  };

  // handleVideo = () => this.setState({ video: !this.state.video }, () => this.getUserMedia());
  // handleAudio = () => this.setState({ audio: !this.state.audio }, () => this.getUserMedia());

  // Replace your old handleVideo function with this one
handleVideo = () => {
  const newVideoState = !this.state.video;
  this.setState({ video: newVideoState }); // This updates the button icon

  if (window.localStream) {
      // Find all video tracks on the stream and toggle their 'enabled' property
      window.localStream.getVideoTracks().forEach(track => {
          track.enabled = newVideoState;
      });
  }
};

// Replace your old handleAudio function with this one
handleAudio = () => {
  const newAudioState = !this.state.audio;
  this.setState({ audio: newAudioState }); // This updates the button icon

  if (window.localStream) {
      // Find all audio tracks on the stream and toggle their 'enabled' property
      window.localStream.getAudioTracks().forEach(track => {
          track.enabled = newAudioState;
      });
  }
};
  handleScreen = () => this.setState({ screen: !this.state.screen }, () => this.getDislayMedia());
  handlePin = (id) => this.setState((prev) => ({ pinnedId: prev.pinnedId === id ? null : id }));

  handleEndCall = () => {
    try {
      let tracks = this.localVideoref.current.srcObject.getTracks();
      tracks.forEach((track) => track.stop());
    } catch (e) { }
    window.location.href = "/";
  };

  openChat = () => this.setState({ showModal: true, newmessages: 0 });
  closeChat = () => this.setState({ showModal: false });
  handleMessage = (e) => this.setState({ message: e.target.value });

  addMessage = (data, sender, socketIdSender) => {
    this.setState((prevState) => ({
      messages: [...prevState.messages, { sender: sender, data: data }],
    }));
    if (socketIdSender !== socketId) {
      this.setState({ newmessages: this.state.newmessages + 1 });
    }
  };

  handleUsername = (e) => this.setState({ username: e.target.value });

  sendMessage = () => {
    socket.emit("chat-message", this.state.message, this.state.username);
    this.setState({ message: "", sender: this.state.username });
  };

  copyUrl = () => {
    let text = window.location.href;
    if (!navigator.clipboard) {
      let textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand("copy");
        message.success("Link copied to clipboard!");
      } catch (err) {
        message.error("Failed to copy");
      }
      document.body.removeChild(textArea);
      return;
    }
    navigator.clipboard.writeText(text).then(
      () => message.success("Link copied to clipboard!"),
      () => message.error("Failed to copy")
    );
  };

  connect = async () => {
    const { userRole, selectedUserDetails, selectedSubject } = this.state;
    if(userRole === 'teacher') {
      if(!selectedSubject || !selectedUserDetails) {
        message.error("Please select a subject before connecting.");
        return;
      }
    }
    else{
      if(!selectedUserDetails) {
        message.error("Please select a user before connecting.");
        return;
      }
    }

    // --- TEACHER: CREATE MEETING RECORD ---
    if (userRole === 'teacher') {
      console.log('[DEBUG] Teacher connecting. Attempting to create meeting record...');
      try {
        const { data, error } = await supabase
          .from('meetings')
          .insert({
            subject: selectedSubject,
            teacher_name: selectedUserDetails.name,
            teacher_id: selectedUserDetails.teacher_id,
            students_doubts: [],
          })
          .select('meeting_id')
          .single();
        
        if (error) throw error;
        
        const newMeetingId = data.meeting_id;
        console.log(`[DEBUG] ✅ Supabase returned meeting_id: ${newMeetingId}`);
        
        this.setState({ meetingId: newMeetingId }, () => {
          console.log(`[DEBUG] Teacher's local meetingId state is now: ${this.state.meetingId}`);
          // Broadcast the meeting ID immediately after setting it
          if (socket) {
            const room = window.location.href;
            console.log(`[DEBUG] Teacher broadcasting meeting ID immediately: ${this.state.meetingId}`);
            socket.emit('meeting-started', room, this.state.meetingId);
          }
        });
        message.success("Meeting record created!");

      } catch (error) {
        console.error("[DEBUG] ❌ ERROR creating meeting:", error.message);
        message.error("Could not create the meeting record.");
        return;
      }
    }
    
    // Save to localStorage
    localStorage.setItem('userDetails', JSON.stringify({
      subject: selectedSubject, role: userRole, name: selectedUserDetails.name, ...selectedUserDetails
    }));
    
    this.setState({ askForUsername: false }, () => this.getMedia());
  };

  connectToSocketServer = () => {
    socket = io.connect(server_url, { secure: true });

    // Remove any existing event listeners to prevent duplicates
    socket.off("signal");
    socket.off("doubt-notification");
    socket.off("meeting-id-received");
    socket.off("request-meeting-id");
    socket.off("user-joined");
    socket.off("username-received");
    socket.off("chat-message");
    socket.off("user-left");
    socket.off("connect");

    socket.on("signal", this.gotMessageFromServer);

    // Set up all event listeners outside the connect event to avoid duplicates
    socket.on('meeting-id-received', (receivedMeetingId) => {
      console.log(`[DEBUG] ✅✅✅ STUDENT RECEIVED MEETING ID: ${receivedMeetingId}`);
      console.log(`[DEBUG] Current userRole: ${this.state.userRole}`);
      this.setState({ meetingId: receivedMeetingId }, () => {
        console.log(`[DEBUG] Student meetingId state is now: ${this.state.meetingId}`);
      });
      this.startAnalysis(); 
    });

    socket.on('request-meeting-id', () => {
      console.log(`[DEBUG] Received request-meeting-id event. userRole: ${this.state.userRole}, meetingId: ${this.state.meetingId}`);
      if (this.state.userRole === 'teacher' && this.state.meetingId) {
        const room = window.location.href;
        console.log(`[DEBUG] Teacher received request for meeting ID. Broadcasting: ${this.state.meetingId}`);
        socket.emit('meeting-started', room, this.state.meetingId);
      }
    });

    socket.on("user-joined", (id, clients) => {
      // Re-broadcast your username to ensure the new user gets it
      socket.emit('username-broadcast', this.state.username);

      // Teacher re-broadcasts the meeting ID when a new user joins
      if (this.state.userRole === 'teacher' && this.state.meetingId) {
        const room = window.location.href;
        console.log(`[DEBUG] New user joined. Teacher re-broadcasting meeting ID: ${this.state.meetingId}`);
        socket.emit('meeting-started', room, this.state.meetingId);
      }
      
      // --- WebRTC Setup Logic ---
      clients.forEach((socketListId) => {
        if (socketListId === socketId) return;
        connections[socketListId] = new RTCPeerConnection(peerConnectionConfig);
        connections[socketListId].onicecandidate = (event) => {
          if (event.candidate != null) {
            socket.emit("signal", socketListId, JSON.stringify({ ice: event.candidate }));
          }
        };
        connections[socketListId].onaddstream = (event) => {
          this.setState((prev) => ({ streams: { ...prev.streams, [socketListId]: event.stream } }));
          // Kick off teacher-side analysis for this remote stream
          if (this.state.userRole === 'teacher') {
            // Wait until video element attaches and is ready
            const tryStart = () => {
              const ref = this.remoteVideoRefs[socketListId];
              const el = ref && ref.current;
              if (el && el.readyState >= 2) {
                console.log(`[CONFUSION] Starting analysis for ${socketListId}`);
                this.startTeacherAnalysisFor(socketListId);
              } else {
                setTimeout(tryStart, 500);
              }
            };
            tryStart();
          }
        };
        if (window.localStream) {
          connections[socketListId].addStream(window.localStream);
        }
      });

      if (id === socketId) {
        for (const id2 in connections) {
          if (id2 === socketId) continue;
          connections[id2].createOffer().then((description) => {
            connections[id2].setLocalDescription(description).then(() => {
              socket.emit("signal", id2, JSON.stringify({ sdp: connections[id2].localDescription }));
            });
          });
        }
      }
    });

    socket.on("username-received", (username, fromId) => {
        this.setState((prev) => ({
            usernames: { ...prev.usernames, [fromId]: username },
        }));
    });
    socket.on("chat-message", this.addMessage);
    socket.on("user-left", (id) => {
        this.setState((prev) => {
            const streams = { ...prev.streams };
            delete streams[id];
            return { ...prev, streams, usernames: { ...prev.usernames, [id]: undefined } };
        });
        delete this.remoteVideoRefs[id];
        // Stop analysis for that user if teacher
        if (this.state.userRole === 'teacher') {
          this.stopTeacherAnalysisFor(id);
        }
    });

    // Handle doubt notifications for teachers
    socket.on("doubt-notification", (data) => {
      console.log('[DEBUG] Received doubt notification:', data);
      console.log('[DEBUG] Current userRole:', this.state.userRole);
      console.log('[DEBUG] Current usernames:', this.state.usernames);
      
      if (this.state.userRole === 'teacher') {
        console.log('[DEBUG] Teacher role confirmed, showing notification');
        message.info(`${data.studentName} has submitted a doubt: "${data.doubt}"`);
        
        // Find the socket ID for this student and show visual notification
        const studentSocketId = Object.keys(this.state.usernames).find(
          id => this.state.usernames[id] === data.studentName
        );
        
        console.log('[DEBUG] Found student socket ID:', studentSocketId, 'for student:', data.studentName);
        
        if (studentSocketId) {
          console.log('[DEBUG] Setting doubt notification for socket ID:', studentSocketId);
          this.setState(prev => ({
            doubtNotifications: {
              ...prev.doubtNotifications,
              [studentSocketId]: true
            }
          }));
          
          // Clear the notification after 10 seconds
          setTimeout(() => {
            console.log('[DEBUG] Clearing doubt notification for socket ID:', studentSocketId);
            this.setState(prev => ({
              doubtNotifications: {
                ...prev.doubtNotifications,
                [studentSocketId]: false
              }
            }));
          }, 10000);
        } else {
          console.log('[DEBUG] Could not find student socket ID for notification');
          console.log('[DEBUG] Available usernames:', this.state.usernames);
          console.log('[DEBUG] Looking for student name:', data.studentName);
        }
      } else {
        console.log('[DEBUG] Not a teacher, ignoring doubt notification');
      }
    });

    socket.on("connect", () => {
      const room = window.location.href;
      socket.emit("join-call", room);
      socketId = socket.id;
      socket.emit('username-broadcast', this.state.username);

      // If you are a teacher, broadcast the meeting ID
      if (this.state.userRole === 'teacher' && this.state.meetingId) {
        console.log(`[DEBUG] Teacher socket connected. Broadcasting meeting ID: ${this.state.meetingId}`);
        socket.emit('meeting-started', room, this.state.meetingId);
      } else if (this.state.userRole === 'student') {
          console.log("[DEBUG] Student socket connected. Now listening for 'meeting-id-received'.");
      }

      // For students: if we don't have a meeting ID after 2 seconds, request it
      if (this.state.userRole === 'student') {
        setTimeout(() => {
          if (!this.state.meetingId) {
            console.log('[DEBUG] Student still has no meeting ID after 2s. Requesting...');
            socket.emit('request-meeting-id');
          }
        }, 2000);
        
        // Also check again after 5 seconds as a fallback
        setTimeout(() => {
          if (!this.state.meetingId) {
            console.log('[DEBUG] Student still has no meeting ID after 5s. Requesting again...');
            socket.emit('request-meeting-id');
          }
        }, 5000);
      }
    });
  };

  isSupportedBrowser = () => {
    let userAgent = (navigator && (navigator.userAgent || "")).toLowerCase();
    let vendor = (navigator && (navigator.vendor || "")).toLowerCase();
    let isChrome = /google inc/.test(vendor) ? userAgent.match(/(?:chrome|crios)\/(\d+)/) : null;
    let isFirefox = userAgent.match(/(?:firefox|fxios)\/(\d+)/);
    return isChrome !== null || isFirefox !== null;
  };

  // Starts the analysis loop
  startAnalysis = () => {
    if (this.state.userRole === 'student' && !this.state.analysisIntervalId) {
      const intervalId = setInterval(this.captureFrameAndAnalyze, 5000); // Analyze every 5 seconds
      this.setState({ analysisIntervalId: intervalId });
      console.log("Confusion analysis started.");
    }
  };

  // Teacher-side: start analysis for a specific remote stream
  startTeacherAnalysisFor = (socketIdForPeer) => {
    if (this.state.userRole !== 'teacher') return;
    if (this.remoteAnalysisIntervals[socketIdForPeer]) return;
    const run = async () => {
      const videoElRef = this.remoteVideoRefs[socketIdForPeer];
      const videoEl = videoElRef && videoElRef.current;
      const canvas = this.canvasRef.current;
      if (!videoEl || !canvas || videoEl.readyState < 2) return;
      try {
        const w = videoEl.videoWidth;
        const h = videoEl.videoHeight;
        if (!w || !h) return;
        const ctx = canvas.getContext('2d');
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(videoEl, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg');
        const base64Data = dataUrl.split(',')[1];
        const resp = await fetch('http://localhost:5000/predict', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64Data })
        });
        if (!resp.ok) {
          console.warn(`[CONFUSION] API HTTP ${resp.status} for ${socketIdForPeer}`);
          return;
        }
        const json = await resp.json();
        if (!json || !json.faces) {
          console.warn(`[CONFUSION] No faces field in response for ${socketIdForPeer}`);
        }
        let label = 'No Face';
        let mainEmotion = undefined;
        if (json && json.faces && json.faces.length > 0) {
          const first = json.faces[0];
          label = first.confusion || 'Not Confused';
          mainEmotion = first.main_emotion;
        }
        this.setState((prev) => ({
          confusionBySocketId: {
            ...prev.confusionBySocketId,
            [socketIdForPeer]: { label, mainEmotion, ts: Date.now() }
          }
        }));
      } catch (e) {
        console.warn(`[CONFUSION] Error analyzing ${socketIdForPeer}:`, e);
      }
    };
    // Run immediately once, then set interval
    run();
    this.remoteAnalysisIntervals[socketIdForPeer] = setInterval(run, 5000);
  };

stopTeacherAnalysisFor = (socketIdForPeer) => {
    // Check if an analysis interval for this specific peer exists
    if (this.remoteAnalysisIntervals[socketIdForPeer]) {
        console.log(`[CONFUSION] Stopping analysis for ${socketIdForPeer}`);
        
        // Use the stored ID to clear the interval
        clearInterval(this.remoteAnalysisIntervals[socketIdForPeer]);
        
        // Remove the property from the intervals object to clean up
        delete this.remoteAnalysisIntervals[socketIdForPeer];
    }
};


  // Stops the analysis loop
  stopAnalysis = () => {
    if (this.state.analysisIntervalId) {
      clearInterval(this.state.analysisIntervalId);
      this.setState({ analysisIntervalId: null });
      console.log("Confusion analysis stopped.");
    }
  };

  // Captures a frame, sends it to the API, and handles the result
  captureFrameAndAnalyze = async () => {
    const video = this.localVideoref.current;
    const canvas = this.canvasRef.current;
    if (!video || !canvas || video.paused || video.ended || video.readyState < 4) {
      return;
    }

    const context = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = canvas.toDataURL('image/jpeg').split(',')[1];

    try {
      const response = await fetch('http://localhost:5000/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageData }),
      });
      const result = await response.json();

      if (result.faces && result.faces.length > 0) {
        const firstFace = result.faces[0];
        if (firstFace.confusion === 'Confused' && !this.state.showConfusionModal) {
          this.setState({ showConfusionModal: true });
        }
      }
    } catch (error) {
      console.error("Error calling analysis API:", error);
    }
  };

  submitDoubt = async () => {
    // This log is the most important one for debugging the error
    console.log(`[DEBUG] Submit Doubt button clicked. Current meetingId is: ${this.state.meetingId}`);

    if (!this.state.confusionDoubtText.trim()) {
      message.error("Please describe your doubt.");
      return;
    }
    
    // If no meeting ID, try to request it first
    if (!this.state.meetingId) {
      console.log('[DEBUG] No meeting ID found. Requesting from teacher...');
      if (this.state.userRole === 'student' && socket) {
        socket.emit('request-meeting-id');
        // Wait a bit and try again
        setTimeout(() => {
          if (!this.state.meetingId) {
            message.error("Cannot submit doubt: meeting not initialized. Please wait for the teacher to start the session.");
          } else {
            this.submitDoubt(); // Retry with the new meeting ID
          }
        }, 1000);
      } else {
        message.error("Cannot submit doubt: meeting not initialized.");
      }
      return;
    }
    
    const userDetails = JSON.parse(localStorage.getItem('userDetails'));
    const doubtText = this.state.confusionDoubtText;
    const newDoubt = {
      student_name: userDetails.name,
      student_id: userDetails.roll_no || userDetails.email, 
      doubt: doubtText,
    };

    try {
      // First, save to database
      const { error } = await supabase.rpc('append_student_doubt', {
        meeting_id_arg: this.state.meetingId,
        new_doubt_arg: newDoubt,
      });

      if (error) {
        message.error("Could not submit your doubt.");
        console.error("Error submitting doubt via RPC:", error);
        return;
      }

      // Send notification to teacher
      if (socket) {
        console.log('[DEBUG] Sending doubt notification to teacher:', {
          studentName: userDetails.name,
          doubt: doubtText,
          meetingId: this.state.meetingId
        });
        socket.emit('student-doubt-submitted', {
          studentName: userDetails.name,
          doubt: doubtText,
          meetingId: this.state.meetingId
        });
      } else {
        console.error('[DEBUG] Socket not available for doubt notification');
      }

      // Get instant AI solution
      this.getInstantAISolution(doubtText, userDetails.name);

      message.success("Your doubt has been submitted to the teacher.");
      this.setState({ showConfusionModal: false, confusionDoubtText: '' });
    } catch (error) {
      console.error("Error in submitDoubt:", error);
      message.error("Could not submit your doubt.");
    }
  };

  getInstantAISolution = async (doubtText, studentName) => {
    console.log('[DEBUG] Getting AI solution for:', doubtText, studentName);
    try {
             const response = await fetch('http://localhost:5001/solve-doubt', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          doubt: doubtText,
          studentName: studentName,
          subject: this.state.selectedSubject || 'General'
        }),
      });

      console.log('[DEBUG] AI solution response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[DEBUG] AI solution error response:', errorText);
        throw new Error('Failed to get AI solution');
      }

      const result = await response.json();
      console.log('[DEBUG] AI solution result:', result);
      
      // Show AI solution in a modal
      this.setState({
        showAISolutionModal: true,
        aiSolution: result.solution,
        originalDoubt: doubtText
      });

      console.log('[DEBUG] AI solution modal should be shown now');

    } catch (error) {
      console.error('Error getting AI solution:', error);
      // Don't show error to user as this is a bonus feature
    }
  };

  render() {
    const { pinnedId } = this.state;

    // The full UI is wrapped in a single div to contain the modals and canvas
    return (
      <div>
        {/* Hidden canvas for capturing video frames for AI analysis */}
        <canvas ref={this.canvasRef} style={{ display: 'none' }}></canvas>

        {/* Modal for the confusion tracker popup */}
        <Modal show={this.state.showConfusionModal} onHide={() => this.setState({ showConfusionModal: false })}>
          <Modal.Header closeButton>
            <Modal.Title>Feeling Confused?</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p>It looks like you might be confused. Please describe your doubt below, and your teacher will be notified.</p>
            <TextField
              fullWidth
              multiline
              rows={4}
              variant="outlined"
              label="What's your confusion?"
              value={this.state.confusionDoubtText}
              onChange={(e) => this.setState({ confusionDoubtText: e.target.value })}
            />
          </Modal.Body>
          <Modal.Footer>
            <Button variant="text" onClick={() => this.setState({ showConfusionModal: false })}>
              Cancel
            </Button>
            <Button variant="contained" color="primary" onClick={this.submitDoubt}>
              Submit Doubt
            </Button>
          </Modal.Footer>
        </Modal>

        {/* Modal for AI Solution */}
        <Modal show={this.state.showAISolutionModal} onHide={() => this.setState({ showAISolutionModal: false })} size="lg">
          <Modal.Header closeButton>
            <Modal.Title>🤖 Instant AI Solution</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div style={{ marginBottom: '20px' }}>
              <Typography variant="h6" color="primary">Your Doubt:</Typography>
              <Typography variant="body1" style={{ fontStyle: 'italic', marginTop: '5px' }}>
                "{this.state.originalDoubt}"
              </Typography>
            </div>
            <div>
              <Typography variant="h6" color="success.main">AI Solution:</Typography>
              <Typography variant="body1" style={{ marginTop: '10px', whiteSpace: 'pre-wrap' }}>
                {this.state.aiSolution}
              </Typography>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="contained" color="primary" onClick={() => this.setState({ showAISolutionModal: false })}>
              Got it!
            </Button>
          </Modal.Footer>
        </Modal>

        {/* Conditional rendering for the "Join Call" screen */}
        {this.state.askForUsername ? (
          <div>
            <div className="username-prompt-container">
              <Typography variant="h6">1. Join Call As...</Typography>
              <ToggleButtonGroup value={this.state.userRole} exclusive onChange={this.handleRoleChange} style={{ margin: '15px 0' }}>
                <ToggleButton value="teacher">Teacher</ToggleButton>
                <ToggleButton value="student">Student</ToggleButton>
              </ToggleButtonGroup>

              {this.state.userRole === 'teacher' && (
                <div style={{ marginTop: '20px' }}>
                  <Typography variant="h6">2. Select Subject</Typography>
                  <TextField select label="Subject" value={this.state.selectedSubject} onChange={this.handleSubjectChange} variant="outlined" style={{ width: 300, margin: '10px auto' }}>
                    <MenuItem value="" disabled><em>Please select a subject...</em></MenuItem>
                    {this.state.availableSubjects.map((subject) => (<MenuItem key={subject} value={subject}>{subject}</MenuItem>))}
                  </TextField>
                </div>
              )}

              {/* {(this.state.userRole === 'teacher' ? !!this.state.selectedSubject : this.state.userRole === 'student') && (
                <div style={{ marginTop: '20px' }}>
                  <Typography variant="h6">3. Select Your Name</Typography>
                  <Autocomplete
                    options={this.state.searchOptions}
                    getOptionLabel={(option) => option.name || ""}
                    value={this.state.selectedUserDetails}
                    onChange={(event, newValue) => this.handleUsernameSelection(newValue)}
                    onInputChange={(event, newInputValue) => this.handleNameSearch(newInputValue)}
                    loading={this.state.loading}
                    style={{ width: 300, margin: '10px auto' }}
                    renderInput={(params) => (
                      <TextField {...params} label={`Search for a ${this.state.userRole}...`} variant="outlined" InputProps={{
                        ...params.InputProps,
                        endAdornment: (<>{this.state.loading ? <CircularProgress color="inherit" size={20} /> : null}{params.InputProps.endAdornment}</>),
                      }} />
                    )}
                  />
                </div>
              )} */}

                            {/* --- CORRECTED RENDER LOGIC --- */}
              {/* Name search shows for students, OR for teachers AFTER they've selected a subject */}
              {(this.state.userRole === 'student' || (this.state.userRole === 'teacher' && this.state.selectedSubject)) && (
                <div style={{ marginTop: '20px' }}>
                    <Typography variant="h6" className="username-prompt-label">
                        {this.state.userRole === 'teacher' ? '3. Select Your Name' : '2. Select Your Name'}
                    </Typography>
                    <Autocomplete
                        style={{ width: 300, margin: '10px auto' }}
                        options={this.state.searchOptions}
                        getOptionLabel={(option) => option.name || ""}
                        value={this.state.selectedUserDetails}
                        onChange={(event, newValue) => this.handleUsernameSelection(newValue)}
                        onInputChange={(event, newInputValue) => this.handleNameSearch(newInputValue)}
                        loading={this.state.loading}
                        renderInput={(params) => (
                        <TextField
                            {...params}
                            label={`Search for a ${this.state.userRole}...`}
                            variant="outlined"
                            InputProps={{
                            ...params.InputProps,
                            endAdornment: (
                                <>
                                {this.state.loading ? <CircularProgress color="inherit" size={20} /> : null}
                                {params.InputProps.endAdornment}
                                </>
                            ),
                            }}
                        />
                        )}
                    />
                </div>
              )}
              {/* --- END CORRECTION --- */}


              <Button variant="contained" color="primary" onClick={this.connect} className="connect-button" style={{ marginTop: '20px' }} disabled={!this.state.username || (this.state.userRole === 'teacher' && !this.state.selectedSubject)}>
                Connect
              </Button>
            </div>
            <div className="video-preview-container">
              <video ref={this.localVideoref} autoPlay muted className="video-preview"></video>
            </div>
          </div>
        ) : (
          // Main Video Call UI
          <div>
            <div className="btn-down">
              <IconButton onClick={this.handleVideo}>{this.state.video ? <VideocamIcon /> : <VideocamOffIcon />}</IconButton>
              <IconButton style={{ color: "#f44336" }} onClick={this.handleEndCall}><CallEndIcon /></IconButton>
              <IconButton onClick={this.handleAudio}>{this.state.audio ? <MicIcon /> : <MicOffIcon />}</IconButton>
              {this.state.screenAvailable && <IconButton onClick={this.handleScreen}>{this.state.screen ? <StopScreenShareIcon /> : <ScreenShareIcon />}</IconButton>}
              <Badge badgeContent={this.state.newmessages} max={999} color="secondary" onClick={this.openChat}>
                <IconButton onClick={this.openChat}><ChatIcon /></IconButton>
              </Badge>
            </div>

            <Modal show={this.state.showModal} onHide={this.closeChat} className="chat-modal">
              <Modal.Header closeButton><Modal.Title>Chat Room</Modal.Title></Modal.Header>
              <Modal.Body style={{ overflowY: 'auto', height: '400px' }}>
                {this.state.messages.length > 0 ? this.state.messages.map((item, index) => (
                  <div key={index}><p><b>{item.sender}</b>: {item.data}</p></div>
                )) : <p>No messages yet.</p>}
              </Modal.Body>
              <Modal.Footer className="div-send-msg">
                <Input placeholder="Message" value={this.state.message} onChange={this.handleMessage} />
                <Button variant="contained" color="primary" onClick={this.sendMessage}>Send</Button>
              </Modal.Footer>
            </Modal>

            <div className="container">
              <Row id="main" className="flex-container" style={{ justifyContent: pinnedId ? "center" : undefined }}>
                {/* {(!pinnedId || pinnedId === "local") && (
                <div className={`video-box ${pinnedId === "local" ? "pinned" : ""}`}>
                  <video id="my-video" ref={this.localVideoref} autoPlay muted controls={false}></video>
                  <span className="name-label">{this.state.username || "Me"}</span>
                  <IconButton className="pin-button" onClick={() => this.handlePin("local")} size="small">
                    <PushPinIcon color={pinnedId === "local" ? "primary" : "action"} />
                  </IconButton>
                </div>
              )} */}
                {/* This is your existing local video tile */}
                {(!pinnedId || pinnedId === "local") && (
                  <div
                    className={`video-box ${pinnedId === "local" ? "pinned" : ""}`}
                    style={{ position: "relative" }} // Ensure parent container is relative
                  >
                    <video id="my-video" ref={this.localVideoref} autoPlay muted controls={false}></video>
                    <span className="name-label">{this.state.username || "Me"}</span>

                                         {this.state.userRole === "student" && (
                       <>
                         <IconButton
                           title="I have a doubt"
                           style={{
                             position: "absolute",
                             top: "8px",
                             left: "8px", // Left corner
                             zIndex: 3,
                             background: "rgba(255,255,255,0.8)",
                           }}
                           onClick={() => this.setState({ showConfusionModal: true })}
                           size="small"
                         >
                           <HelpOutlineIcon color="primary" />
                         </IconButton>
                         
                         {/* Test notification button for debugging */}
                         <IconButton
                           title="Test notification"
                           style={{
                             position: "absolute",
                             top: "8px",
                             left: "50px", // Next to doubt button
                             zIndex: 3,
                             background: "rgba(255,255,255,0.8)",
                           }}
                           onClick={() => {
                             console.log('[DEBUG] Test notification clicked');
                             if (socket) {
                               socket.emit('student-doubt-submitted', {
                                 studentName: this.state.username,
                                 doubt: "Test doubt for debugging",
                                 meetingId: this.state.meetingId
                               });
                             }
                           }}
                           size="small"
                         >
                           🧪
                         </IconButton>
                        
                        {/* Meeting Status Indicator */}
                        <div
                          style={{
                            position: "absolute",
                            top: "8px",
                            right: "8px",
                            zIndex: 3,
                            background: this.state.meetingId ? "rgba(76, 175, 80, 0.9)" : "rgba(244, 67, 54, 0.9)",
                            color: "white",
                            padding: "4px 8px",
                            borderRadius: "12px",
                            fontSize: "10px",
                            fontWeight: "bold",
                          }}
                        >
                          {this.state.meetingId ? "✓ Connected" : "⏳ Connecting..."}
                        </div>
                      </>
                    )}

                    <IconButton className="pin-button" onClick={() => this.handlePin("local")} size="small">
                      <PushPinIcon color={pinnedId === "local" ? "primary" : "action"} />
                    </IconButton>
                    
                    {/* Test button for teacher to check if socket events are working */}
                    {this.state.userRole === "teacher" && (
                      <IconButton
                        title="Test socket events"
                        style={{
                          position: "absolute",
                          top: "8px",
                          left: "8px",
                          zIndex: 3,
                          background: "rgba(255,255,255,0.8)",
                        }}
                        onClick={() => {
                          console.log('[DEBUG] Teacher test button clicked');
                          console.log('[DEBUG] Current usernames:', this.state.usernames);
                          console.log('[DEBUG] Current doubtNotifications:', this.state.doubtNotifications);
                        }}
                        size="small"
                      >
                        🔧
                      </IconButton>
                    )}
                  </div>

                )}

                {Object.entries(this.state.streams).map(([id, stream]) => {
                  if (!this.remoteVideoRefs[id]) this.remoteVideoRefs[id] = React.createRef();
                  if (pinnedId && pinnedId !== id) return null;
                  const username = this.state.usernames[id] || "User";
                  const confusion = this.state.confusionBySocketId[id];
                  const badgeBg = confusion ? (confusion.label === 'Confused' ? 'rgba(244,67,54,0.9)' : 'rgba(76,175,80,0.9)') : 'rgba(0,0,0,0.4)';
                  return (
                    <div key={id} className={`video-box ${pinnedId === id ? "pinned" : ""}`}>
                      {stream && stream.getVideoTracks().length > 0 && stream.getVideoTracks()[0].enabled ? (
                        <video
                          ref={el => { this.remoteVideoRefs[id].current = el; if (el && el.srcObject !== stream) { el.srcObject = stream; } }}
                          autoPlay playsInline controls={false}
                        ></video>
                      ) : (
                        <div className="no-video-placeholder">
                          <span className="icon">📷</span>
                          <span className="text">NO VIDEO</span>
                        </div>
                      )}
                                             {/* Confusion badge for teacher view */}
                       {this.state.userRole === 'teacher' && (
                         <div
                           style={{
                             position: 'absolute',
                             top: '8px',
                             left: '8px',
                             zIndex: 3,
                             background: badgeBg,
                             color: 'white',
                             padding: '4px 8px',
                             borderRadius: '12px',
                             fontSize: '10px',
                             fontWeight: 'bold'
                           }}
                           title={confusion && confusion.mainEmotion ? `Emotion: ${confusion.mainEmotion}` : ''}
                         >
                           {confusion ? (confusion.label === 'Confused' ? 'Confused' : 'Not Confused') : 'Analyzing...'}
                         </div>
                       )}
                       
                       {/* Doubt notification indicator for teacher view */}
                       {this.state.userRole === 'teacher' && this.state.doubtNotifications && this.state.doubtNotifications[id] && (
                         <div
                           style={{
                             position: 'absolute',
                             top: '8px',
                             right: '8px',
                             zIndex: 3,
                             background: 'rgba(255, 193, 7, 0.9)',
                             color: 'white',
                             padding: '4px 8px',
                             borderRadius: '12px',
                             fontSize: '10px',
                             fontWeight: 'bold',
                             animation: 'pulse 2s infinite'
                           }}
                           title="Student has submitted a doubt"
                         >
                           ❓ Doubt
                         </div>
                       )}
                      <span className="name-label">{username}</span>
                      <IconButton className="pin-button" onClick={() => this.handlePin(id)} size="small">
                        <PushPinIcon color={pinnedId === id ? "primary" : "action"} />
                      </IconButton>
                    </div>
                  );
                })}
              </Row>
            </div>
          </div>
        )}
      </div>
    );
  }
}

export default Video;
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

// 1. Create the Context
const AuthContext = createContext({});

// 2. Create the Provider Component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true); // Starts loading

  useEffect(() => {
    const initAuth = async () => {
      try {
        // Get current session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          const u = session.user;
          setUser(u);
          console.log("🔍 Checking DB for AuthID:", u.id);

          // Try Teachers table
          const { data: teacher } = await supabase
            .from('teachers')
            .select('*')
            .eq('auth_id', u.id)
            .maybeSingle();

          if (teacher) {
            console.log("✅ Teacher Profile Loaded");
            setProfile(teacher);
            setRole('teacher');
          } else {
            // Try Students table
            const { data: student } = await supabase
              .from('students')
              .select('*')
              .eq('auth_id', u.id)
              .maybeSingle();

            if (student) {
              console.log("✅ Student Profile Loaded");
              setProfile(student);
              setRole('student');
            } else {
               console.warn("⚠️ User logged in, but not found in teachers or students tables.");
            }
          }
        }
      } catch (err) {
        console.error("❌ Auth Error:", err);
      } finally {
        // CRITICAL: Always set loading to false so the screen doesn't stay white
        setLoading(false); 
      }
    };

    initAuth();

    // Listen for logouts
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setUser(null);
        setProfile(null);
        setRole(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, role, loading }}>
      {/* Rendering children immediately prevents the white screen crash */}
      {children}
    </AuthContext.Provider>
  );
};

// 3. Create the Custom Hook
export const useAuth = () => useContext(AuthContext);
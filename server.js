const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files (HTML, CSS, JS)
app.use(express.static('.'));

// Supabase setup
const supabaseUrl = process.env.SUPABASE_URL || 'https://lkjfkbififhwgvamffir.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxramZrYmlmaWZod2d2YW1mZmlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MTE4OTcsImV4cCI6MjA5MTk4Nzg5N30.96SQDKM-AQ_CIyXTQsv3CG9etJDqnexEMADqWnQDTyw';
const supabase = createClient(supabaseUrl, supabaseKey);

// Routes

// Sign up endpoint
app.post('/api/signup', async (req, res) => {
  try {
    const { email, password, username } = req.body;

    if (!email || !password || !username) {
      return res.status(400).json({ error: 'Missing email, password, or username' });
    }

    // Sign up user with Supabase
    const { data: authData, error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username
        }
      }
    });

    if (signupError) throw signupError;

    // Create user profile
    if (authData.user) {
      await supabase
        .from('user_profiles')
        .insert({
          id: authData.user.id,
          email,
          username,
          is_verified: true,
          verified_at: new Date(),
        });
    }

    res.json({ success: true, message: 'Account created successfully' });

  } catch (error) {
    console.error('Error signing up:', error);
    res.status(500).json({ error: error.message });
  }
});

// Sign in endpoint
app.post('/api/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Missing email or password' });
    }

    // Sign in user with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    res.json({ success: true, user: data.user, session: data.session });

  } catch (error) {
    console.error('Error signing in:', error);
    res.status(500).json({ error: error.message });
  }
});

// Sign out endpoint
app.post('/api/signout', async (req, res) => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    res.json({ success: true, message: 'Signed out successfully' });
  } catch (error) {
    console.error('Error signing out:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Serve index.html for all non-API routes (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
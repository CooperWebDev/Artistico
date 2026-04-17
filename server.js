const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Supabase setup
const supabaseUrl = process.env.SUPABASE_URL || 'https://lkjfkbififhwgvamffir.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxramZrYmlmaWZod2d2YW1mZmlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MTE4OTcsImV4cCI6MjA5MTk4Nzg5N30.96SQDKM-AQ_CIyXTQsv3CG9etJDqnexEMADqWnQDTyw';
const supabase = createClient(supabaseUrl, supabaseKey);

// Email transporter (using Gmail - replace with your email service)
const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Generate random password
function generatePassword() {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*';
  const all = uppercase + lowercase + numbers + special;

  let password = '';
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];

  for (let i = 4; i < 12; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }

  return password.split('').sort(() => 0.5 - Math.random()).join('');
}

// Generate verification token
function generateVerificationToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Routes

// Send verification email
app.post('/api/send-verification-email', async (req, res) => {
  try {
    const { email, fullName } = req.body;

    if (!email || !fullName) {
      return res.status(400).json({ error: 'Missing email or fullName' });
    }

    // Generate password and token
    const generatedPassword = generatePassword();
    const verificationToken = generateVerificationToken();

    // Store verification token in database
    const { error: tokenError } = await supabase
      .from('verification_tokens')
      .insert({
        email,
        token: verificationToken,
        password: generatedPassword,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      });

    if (tokenError) throw tokenError;

    // Send verification email
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8000';
    const verificationLink = `${frontendUrl}/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`;

    const mailOptions = {
      from: process.env.EMAIL_USER || 'your-email@gmail.com',
      to: email,
      subject: 'Verify your Anime Walls account',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #6366f1;">Welcome to Anime Walls, ${fullName}!</h2>
          <p>Thank you for signing up. Please verify your email to continue.</p>
          <a href="${verificationLink}" style="
            display: inline-block;
            background-color: #6366f1;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            margin: 20px 0;
          ">Verify Email</a>
          <p>Or paste this link: ${verificationLink}</p>
          <p style="color: #666; font-size: 12px;">This link expires in 24 hours.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.json({ success: true, message: 'Verification email sent' });

  } catch (error) {
    console.error('Error sending verification email:', error);
    res.status(500).json({ error: error.message });
  }
});

// Verify email and create account
app.get('/api/verify-email', async (req, res) => {
  try {
    const { token, email } = req.query;

    if (!token || !email) {
      return res.status(400).json({ error: 'Missing token or email' });
    }

    // Fetch token data
    const { data: tokenData, error: tokenError } = await supabase
      .from('verification_tokens')
      .select('*')
      .eq('token', token)
      .eq('email', email)
      .single();

    if (tokenError || !tokenData) {
      return res.status(400).json({ error: 'Invalid or expired verification link' });
    }

    if (tokenData.used) {
      return res.status(400).json({ error: 'This verification link has already been used' });
    }

    if (new Date(tokenData.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Verification link has expired' });
    }

    // Create user account
    const { data: authData, error: signupError } = await supabase.auth.signUp({
      email,
      password: tokenData.password,
      options: {
        emailRedirectTo: 'http://localhost:8000',
      },
    });

    if (signupError) throw signupError;

    // Mark token as used
    await supabase
      .from('verification_tokens')
      .update({ used: true })
      .eq('id', tokenData.id);

    // Create user profile
    await supabase
      .from('user_profiles')
      .insert({
        id: authData.user.id,
        email,
        is_verified: true,
        verified_at: new Date(),
      });

    // Send password email
    const passwordMailOptions = {
      from: process.env.EMAIL_USER || 'your-email@gmail.com',
      to: email,
      subject: 'Your Anime Walls Account Password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #10b981;">Email Verified Successfully!</h2>
          <p>Your account has been created. Here is your temporary password:</p>
          <div style="background: #f9fafb; border: 2px dashed #d1d5db; padding: 20px; margin: 20px 0; text-align: center;">
            <code style="font-size: 18px; font-weight: bold; letter-spacing: 2px;">${tokenData.password}</code>
          </div>
          <p>Please save this password and use it to log in to your account.</p>
          <p>You can now <a href="http://localhost:8000">log in here</a>.</p>
        </div>
      `,
    };

    await transporter.sendMail(passwordMailOptions);

    // Return success with password
    res.json({ 
      success: true, 
      message: 'Email verified successfully', 
      password: tokenData.password 
    });

  } catch (error) {
    console.error('Error verifying email:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
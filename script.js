document.addEventListener('DOMContentLoaded', function() {
  // Supabase setup - Replace with your actual keys
  const supabaseUrl = 'https://lkjfkbififhwgvamffir.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxramZrYmlmaWZod2d2YW1mZmlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MTE4OTcsImV4cCI6MjA5MTk4Nzg5N30.96SQDKM-AQ_CIyXTQsv3CG9etJDqnexEMADqWnQDTyw';
  const supabase = supabase.createClient(supabaseUrl, supabaseKey);

  // Backend URL - change this when deploying
  const backendUrl = 'http://localhost:3000';

  const searchInput = document.getElementById('search-input');
  const searchBtn = document.getElementById('search-btn');
  const chips = document.querySelectorAll('.chip');
  let cards = document.querySelectorAll('.photo-card');
  const sidebarLinks = document.querySelectorAll('.sidebar-link');
  const filterBtn = document.querySelector('.icon-action[title="Reset filter"]');

  let activeFilter = 'all';
  let currentEmail = null;
  let currentFullName = null;

  function filterCards(query, category) {
    const searchTerm = query.toLowerCase().trim();

    cards.forEach(card => {
      const tags = card.dataset.tags.toLowerCase();
      const title = card.querySelector('img').alt.toLowerCase();

      const matchesCategory = category === 'all' || tags.includes(category);
      const matchesSearch = searchTerm === '' || title.includes(searchTerm) || tags.includes(searchTerm);

      card.style.display = matchesCategory && matchesSearch ? 'block' : 'none';
    });
  }

  function setActiveChip(selectedChip) {
    chips.forEach(chip => chip.classList.remove('active'));
    selectedChip.classList.add('active');
    activeFilter = selectedChip.dataset.filter || 'all';
    filterCards(searchInput.value, activeFilter);
  }

  // ============ AUTH STATE MANAGEMENT ============
  async function checkAuthStatus() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
      await displayUserMenu(session.user);
    } else {
      displayAuthButtons();
    }
    
    // Check for verification token in URL
    const params = new URLSearchParams(window.location.search);
    if (params.get('token') && params.get('email')) {
      await verifyEmailAndCreateAccount(params.get('email'), params.get('token'));
    }
  }

  function displayAuthButtons() {
    document.getElementById('signup-btn').classList.remove('hidden');
    document.getElementById('login-btn').classList.remove('hidden');
    document.getElementById('user-menu').classList.add('hidden');
  }

  async function displayUserMenu(user) {
    document.getElementById('signup-btn').classList.add('hidden');
    document.getElementById('login-btn').classList.add('hidden');
    document.getElementById('user-menu').classList.remove('hidden');
    
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (data) {
      document.getElementById('user-name').textContent = data.username || user.email;
      document.getElementById('user-email').textContent = user.email;
      if (data.avatar_url) {
        document.getElementById('user-avatar').src = data.avatar_url;
      }
    }
  }

  chips.forEach(chip => {
    chip.addEventListener('click', function() {
      setActiveChip(this);
    });
  });

  if (searchBtn) {
    searchBtn.addEventListener('click', function() {
      filterCards(searchInput.value, activeFilter);
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', function() {
      filterCards(this.value, activeFilter);
    });
    searchInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        filterCards(this.value, activeFilter);
      }
    });
  }

  if (filterBtn) {
    filterBtn.addEventListener('click', function() {
      searchInput.value = '';
      setActiveChip(document.querySelector('.chip[data-filter="all"]'));
      searchInput.focus();
    });
  }

  sidebarLinks.forEach((link, index) => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      sidebarLinks.forEach(el => el.classList.remove('active'));
      this.classList.add('active');

      // If it's the settings cog (last one, index 4)
      if (index === 4) {
        document.getElementById('settings-panel').classList.toggle('hidden');
      }
    });
  });

  // ============ SIGN UP FLOW ============
  document.getElementById('signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('signup-email').value.trim();
    const fullName = document.getElementById('signup-name').value.trim();
    
    if (!email || !fullName) {
      alert('Please fill in all fields');
      return;
    }
    
    currentEmail = email;
    currentFullName = fullName;
    
    try {
      // Call backend for verification email
      const response = await fetch(`${backendUrl}/api/send-verification-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, fullName }),
      });
      
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error);
      
      // Show verification modal
      document.getElementById('signup-modal').classList.add('hidden');
      document.getElementById('verify-email-display').textContent = email;
      document.getElementById('verify-email-modal').classList.remove('hidden');
      
    } catch (error) {
      alert('Error: ' + error.message);
    }
  });

  // ============ EMAIL VERIFICATION ============
  async function verifyEmailAndCreateAccount(email, token) {
    try {
      // Call backend to verify email
      const response = await fetch(`${backendUrl}/api/verify-email?token=${token}&email=${encodeURIComponent(email)}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Verification failed');
      }
      
      // Show password modal with temporary password
      document.getElementById('verify-email-modal').classList.add('hidden');
      document.getElementById('temp-password-display').textContent = data.password;
      document.getElementById('password-modal').classList.remove('hidden');
      
    } catch (error) {
      alert('Verification error: ' + error.message);
    }
  }

  document.getElementById('resend-email-btn').addEventListener('click', async () => {
    try {
      const response = await fetch(`${backendUrl}/api/send-verification-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: currentEmail, fullName: currentFullName }),
      });
      
      if (!response.ok) throw new Error('Failed to resend email');
      
      alert('Verification email resent! Check your inbox.');
    } catch (error) {
      alert('Error: ' + error.message);
    }
  });

  document.getElementById('copy-password-btn').addEventListener('click', () => {
    const password = document.getElementById('temp-password-display').textContent;
    navigator.clipboard.writeText(password);
    alert('Password copied to clipboard!');
  });

  document.getElementById('proceed-login-btn').addEventListener('click', () => {
    document.getElementById('password-modal').classList.add('hidden');
    document.getElementById('login-modal').classList.remove('hidden');
    document.getElementById('login-email').value = currentEmail;
    document.getElementById('login-email').focus();
  });

  // ============ LOGIN FLOW ============
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      
      document.getElementById('login-modal').classList.add('hidden');
      await displayUserMenu(data.user);
      
      // Clear form
      document.getElementById('login-form').reset();
      
    } catch (error) {
      alert('Login error: ' + error.message);
    }
  });

  // ============ MODAL CONTROLS ============
  document.getElementById('signup-btn').addEventListener('click', () => {
    document.getElementById('login-modal').classList.add('hidden');
    document.getElementById('signup-modal').classList.remove('hidden');
  });

  document.getElementById('login-btn').addEventListener('click', () => {
    document.getElementById('signup-modal').classList.add('hidden');
    document.getElementById('login-modal').classList.remove('hidden');
  });

  document.querySelectorAll('.toggle-auth').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('signup-modal').classList.toggle('hidden');
      document.getElementById('login-modal').classList.toggle('hidden');
    });
  });

  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.target.closest('.modal').classList.add('hidden');
    });
  });

  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
      }
    });
  });

  // ============ LOGOUT ============
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await supabase.auth.signOut();
    document.getElementById('user-menu').classList.add('hidden');
    displayAuthButtons();
    window.location.href = '#home';
  });

  // ============ USER MENU TOGGLE ============
  let userMenuOpen = false;
  document.querySelector('.navbar-auth').addEventListener('click', (e) => {
    if (!e.target.closest('#user-menu') && e.target.id !== 'user-menu') {
      userMenuOpen = !userMenuOpen;
      if (userMenuOpen && !document.getElementById('user-menu').classList.contains('hidden')) {
        document.getElementById('user-menu').classList.add('hidden');
        userMenuOpen = false;
      }
    }
  });

  // ============ UPLOAD FUNCTIONALITY ============
  document.getElementById('upload-wallpaper-btn').addEventListener('click', () => {
    const uploadModal = document.getElementById('upload-modal');
    if (uploadModal) {
      uploadModal.classList.remove('hidden');
      document.getElementById('user-menu').classList.add('hidden');
    }
  });

  // ============ UPLOAD FILE HANDLING ============
  const uploadForm = document.getElementById('upload-form');
  const fileInput = document.getElementById('upload-image');
  const fileUploadArea = document.querySelector('.file-upload-area');
  const uploadPreview = document.getElementById('upload-preview');
  const previewImage = document.getElementById('preview-image');

  fileUploadArea.addEventListener('click', () => fileInput.click());

  fileUploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    fileUploadArea.style.borderColor = '#6366f1';
  });

  fileUploadArea.addEventListener('dragleave', () => {
    fileUploadArea.style.borderColor = '#d1d5db';
  });

  fileUploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer.files[0]) {
      fileInput.files = e.dataTransfer.files;
      handleFileSelect();
    }
  });

  fileInput.addEventListener('change', handleFileSelect);

  function handleFileSelect() {
    if (fileInput.files[0]) {
      const reader = new FileReader();
      reader.onload = (e) => {
        previewImage.src = e.target.result;
        uploadPreview.classList.remove('hidden');
      };
      reader.readAsDataURL(fileInput.files[0]);
    }
  }

  document.getElementById('remove-image').addEventListener('click', (e) => {
    e.preventDefault();
    fileInput.value = '';
    uploadPreview.classList.add('hidden');
  });

  // ============ UPLOAD SUBMISSION ============
  uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('You must be logged in to upload');
      return;
    }

    const file = fileInput.files[0];
    if (!file) {
      alert('Please select an image');
      return;
    }

    const title = document.getElementById('upload-title').value;
    const description = document.getElementById('upload-description').value;
    const category = document.getElementById('upload-category').value;
    const tags = document.getElementById('upload-tags').value.split(',').map(t => t.trim());
    const isPublic = document.getElementById('upload-public').checked;

    try {
      // Upload image to storage
      const filePath = `${user.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('wallpapers')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('wallpapers')
        .getPublicUrl(filePath);

      // Save wallpaper metadata
      const { error: dbError } = await supabase
        .from('wallpapers')
        .insert({
          user_id: user.id,
          title,
          description,
          image_url: publicUrl,
          tags,
          category,
          is_public: isPublic,
        });

      if (dbError) throw dbError;

      alert('Wallpaper uploaded successfully!');
      document.getElementById('upload-modal').classList.add('hidden');
      uploadForm.reset();
      uploadPreview.classList.add('hidden');

    } catch (error) {
      alert('Upload error: ' + error.message);
    }
  });

  // Settings panel
  const settingsPanel = document.getElementById('settings-panel');
  const closeSettings = document.getElementById('close-settings');
  const darkModeToggle = document.getElementById('dark-mode-toggle');

  if (closeSettings) {
    closeSettings.addEventListener('click', () => {
      settingsPanel.classList.add('hidden');
    });
  }

  if (darkModeToggle) {
    darkModeToggle.addEventListener('change', () => {
      document.body.classList.toggle('dark-mode');
    });
  }

  // Close settings on outside click
  if (settingsPanel) {
    settingsPanel.addEventListener('click', (e) => {
      if (e.target === settingsPanel) {
        settingsPanel.classList.add('hidden');
      }
    });
  }

  document.querySelectorAll('.navbar-links a').forEach(link => {
    link.addEventListener('click', function() {
      document.querySelectorAll('.navbar-links a').forEach(el => el.classList.remove('active'));
      this.classList.add('active');
    });
  });

  // Initialize
  checkAuthStatus();
  filterCards('', 'all');
});

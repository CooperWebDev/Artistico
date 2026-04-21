// Wait for Supabase to load, then initialize
function initializeApp() {
  if (typeof window.supabase === 'undefined') {
    // Retry after a short delay
    setTimeout(initializeApp, 100);
    return;
  }

  // Supabase setup - Replace with your actual keys
  const supabaseUrl = 'https://lkjfkbififhwgvamffir.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxramZrYmlmaWZod2d2YW1mZmlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MTE4OTcsImV4cCI6MjA5MTk4Nzg5N30.96SQDKM-AQ_CIyXTQsv3CG9etJDqnexEMADqWnQDTyw';
  const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

  // Backend URL - change this when deploying
  // Backend URL configuration
  const backendUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://artistico-coyl.onrender.com';

  const searchInput = document.getElementById('search-input');
  const searchBtn = document.getElementById('search-btn');
  const chips = document.querySelectorAll('.chip');
  const sidebarLinks = document.querySelectorAll('.sidebar-link');
  const filterBtn = document.querySelector('.icon-action[title="Reset filter"]');
  const galleryGrid = document.getElementById('wallpapers');
  const loadingState = document.getElementById('loading-wallpapers');
  const emptyState = document.getElementById('no-wallpapers');

  let activeFilter = 'all';
  let currentEmail = null;
  let currentFullName = null;
  let allWallpapers = []; // Store all wallpapers for filtering

  // ============ LOAD WALLPAPERS FROM SUPABASE ============
  async function loadWallpapers() {
    try {
      loadingState.style.display = 'block';
      emptyState.style.display = 'none';

      const { data: wallpapers, error } = await supabaseClient
        .from('wallpapers')
        .select('*')
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      allWallpapers = wallpapers || [];
      displayWallpapers(allWallpapers);

    } catch (error) {
      console.error('Error loading wallpapers:', error);
      loadingState.innerHTML = '<p>Error loading wallpapers. Please try again.</p>';
    } finally {
      loadingState.style.display = 'none';
    }
  }

  // ============ DISPLAY WALLPAPERS ============
  function displayWallpapers(wallpapers) {
    // Clear existing wallpapers (keep loading/empty states)
    const existingCards = galleryGrid.querySelectorAll('.photo-card');
    existingCards.forEach(card => card.remove());

    if (wallpapers.length === 0) {
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';

    wallpapers.forEach(wallpaper => {
      const card = createWallpaperCard(wallpaper);
      galleryGrid.appendChild(card);
    });
  }

  // ============ CREATE WALLPAPER CARD ============
  function createWallpaperCard(wallpaper) {
    const card = document.createElement('article');
    card.className = 'photo-card';
    card.dataset.tags = (wallpaper.tags || []).join(' ') + ' ' + (wallpaper.category || 'fanart');

    const img = document.createElement('img');
    img.src = wallpaper.image_url;
    img.alt = wallpaper.title;
    img.loading = 'lazy';

    card.appendChild(img);
    return card;
  }

  // ============ FILTER WALLPAPERS ============
  function filterWallpapers(query, category) {
    const searchTerm = query.toLowerCase().trim();

    const filteredWallpapers = allWallpapers.filter(wallpaper => {
      const tags = ((wallpaper.tags || []).join(' ') + ' ' + (wallpaper.category || 'fanart')).toLowerCase();
      const title = (wallpaper.title || '').toLowerCase();
      const description = (wallpaper.description || '').toLowerCase();

      const matchesCategory = category === 'all' || tags.includes(category);
      const matchesSearch = searchTerm === '' ||
        title.includes(searchTerm) ||
        description.includes(searchTerm) ||
        tags.includes(searchTerm);

      return matchesCategory && matchesSearch;
    });

    displayWallpapers(filteredWallpapers);
  }

  function setActiveChip(selectedChip) {
    chips.forEach(chip => chip.classList.remove('active'));
    selectedChip.classList.add('active');
    activeFilter = selectedChip.dataset.filter || 'all';
    filterWallpapers(searchInput.value, activeFilter);
  }

  // ============ AUTH STATE MANAGEMENT ============
  async function checkAuthStatus() {
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (session) {
      await displayUserMenu(session.user);
    } else {
      displayAuthButtons();
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
    
    const { data } = await supabaseClient
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (data) {
      document.getElementById('user-name').textContent = data.username || data.email || user.email;
      document.getElementById('user-email').textContent = user.email;
      if (data.avatar_url) {
        document.getElementById('user-avatar').src = data.avatar_url;
      }
      
      // Also update settings profile tab
      document.getElementById('profile-username').textContent = data.username || user.email;
      document.getElementById('profile-email').textContent = user.email;
      if (data.avatar_url) {
        document.getElementById('profile-avatar').src = data.avatar_url;
      }
      if (data.bio) {
        document.getElementById('profile-bio').value = data.bio;
      }
    } else {
      document.getElementById('user-name').textContent = user.email;
      document.getElementById('user-email').textContent = user.email;
      document.getElementById('profile-username').textContent = user.email;
      document.getElementById('profile-email').textContent = user.email;
    }
  }

  chips.forEach(chip => {
    chip.addEventListener('click', function() {
      setActiveChip(this);
    });
  });

  if (searchBtn) {
    searchBtn.addEventListener('click', function() {
      filterWallpapers(searchInput.value, activeFilter);
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', function() {
      filterWallpapers(this.value, activeFilter);
    });
    searchInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        filterWallpapers(this.value, activeFilter);
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
    const username = document.getElementById('signup-name').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm-password').value;
    const errorDiv = document.getElementById('signup-error');
    const submitBtn = document.getElementById('signup-submit-btn');

    // Validation
    if (!email || !username || !password || !confirmPassword) {
      errorDiv.textContent = 'Please fill in all fields';
      errorDiv.style.display = 'block';
      return;
    }

    if (password.length < 6) {
      errorDiv.textContent = 'Password must be at least 6 characters long';
      errorDiv.style.display = 'block';
      return;
    }

    if (password !== confirmPassword) {
      errorDiv.textContent = 'Passwords do not match';
      errorDiv.style.display = 'block';
      return;
    }

    if (username.length < 3) {
      errorDiv.textContent = 'Username must be at least 3 characters long';
      errorDiv.style.display = 'block';
      return;
    }

    try {
      errorDiv.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating account...';

      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
          },
        },
      });

      if (error) throw error;

      // Create user profile
      const { error: profileError } = await supabaseClient
        .from('user_profiles')
        .insert({
          id: data.user.id,
          username,
          email,
        });

      if (profileError) throw profileError;

      document.getElementById('signup-modal').classList.add('hidden');
      errorDiv.style.display = 'none';
      alert('Account created successfully! You can now log in.');
      document.getElementById('signup-form').reset();
    } catch (error) {
      errorDiv.textContent = 'Error: ' + error.message;
      errorDiv.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Account';
    }
  });

  // ============ LOGOUT ============
  document.getElementById('logout-btn').addEventListener('click', async () => {
    try {
      // Sign out directly with Supabase client
      const { error } = await supabaseClient.auth.signOut();
      if (error) throw error;

      // Update UI
      displayAuthButtons();

    } catch (error) {
      console.error('Logout error:', error);
      // Still update UI even if logout fails
      displayAuthButtons();
    }
  });

  // ============ LOGIN FORM ============
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errorDiv = document.getElementById('login-error');
    const submitBtn = document.getElementById('login-submit-btn');

    if (!email || !password) {
      errorDiv.textContent = 'Please enter both email and password';
      errorDiv.style.display = 'block';
      return;
    }

    try {
      errorDiv.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.textContent = 'Logging in...';

      // Sign in directly with Supabase client
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      // Success - close modal and update UI
      document.getElementById('login-modal').classList.add('hidden');
      await displayUserMenu(data.user);

      // Clear form
      document.getElementById('login-form').reset();

    } catch (error) {
      errorDiv.textContent = 'Login error: ' + error.message;
      errorDiv.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Login';
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

  // ============ USER MENU TOGGLE ============
  let userMenuOpen = false;
  
  // Toggle user menu when clicking on profile area
  document.querySelector('.user-profile')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const userMenu = document.getElementById('user-menu');
    userMenuOpen = !userMenuOpen;
    if (userMenuOpen) {
      userMenu.classList.remove('hidden');
    } else {
      userMenu.classList.add('hidden');
    }
  });

  // Close menu when clicking elsewhere
  document.addEventListener('click', () => {
    if (userMenuOpen) {
      document.getElementById('user-menu').classList.add('hidden');
      userMenuOpen = false;
    }
  });

  // Settings button in user menu
  document.getElementById('settings-btn')?.addEventListener('click', () => {
    document.getElementById('settings-panel').classList.remove('hidden');
    document.getElementById('user-menu').classList.add('hidden');
    userMenuOpen = false;
  });

  // My uploads button in user menu
  document.getElementById('my-uploads-btn')?.addEventListener('click', () => {
    const settingsPanel = document.getElementById('settings-panel');
    settingsPanel.classList.remove('hidden');
    
    // Switch to uploads tab
    document.querySelectorAll('.settings-tab').forEach(tab => {
      tab.classList.remove('active');
      if (tab.dataset.tab === 'uploads') {
        tab.classList.add('active');
      }
    });
    
    document.querySelectorAll('.settings-tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById('uploads-tab').classList.add('active');
    
    loadUserUploads();
    document.getElementById('user-menu').classList.add('hidden');
    userMenuOpen = false;
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
    
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      alert('You must be logged in to upload');
      return;
    }

    const file = fileInput.files[0];
    if (!file) {
      alert('Please select an image');
      return;
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      alert('File size must be less than 5MB');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file');
      return;
    }

    const title = document.getElementById('upload-title').value;
    const description = document.getElementById('upload-description').value;
    const category = document.getElementById('upload-category').value;
    const tags = document.getElementById('upload-tags').value.split(',').map(t => t.trim()).filter(t => t);
    const isPublic = document.getElementById('upload-public').checked;
    const submitBtn = document.getElementById('upload-submit-btn');
    const progressDiv = document.getElementById('upload-progress');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    const errorDiv = document.getElementById('upload-error');

    try {
      errorDiv.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.textContent = 'Uploading...';
      progressDiv.classList.remove('hidden');

      // Upload image to storage with progress tracking
      const filePath = `${user.id}/${Date.now()}-${file.name}`;
      
      const { error: uploadError } = await supabaseClient.storage
        .from('wallpapers')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      progressFill.style.width = '50%';
      progressText.textContent = 'Processing upload...';

      // Get public URL
      const { data: { publicUrl } } = supabaseClient.storage
        .from('wallpapers')
        .getPublicUrl(filePath);

      progressFill.style.width = '75%';
      progressText.textContent = 'Saving metadata...';

      // Save wallpaper metadata
      const { error: dbError } = await supabaseClient
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

      progressFill.style.width = '100%';
      progressText.textContent = 'Upload complete!';

      setTimeout(() => {
        alert('Wallpaper uploaded successfully!');
        document.getElementById('upload-modal').classList.add('hidden');
        uploadForm.reset();
        uploadPreview.classList.add('hidden');
        progressDiv.classList.add('hidden');
        progressFill.style.width = '0%';

        // Refresh the wallpaper gallery
        loadWallpapers();
      }, 1000);

    } catch (error) {
      errorDiv.textContent = 'Upload error: ' + error.message;
      errorDiv.style.display = 'block';
      progressDiv.classList.add('hidden');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Upload Wallpaper';
    }
  });

  // Settings panel
  const settingsPanel = document.getElementById('settings-panel');
  const closeSettings = document.getElementById('close-settings');
  const darkModeToggle = document.getElementById('dark-mode-toggle');
  const settingsTabs = document.querySelectorAll('.settings-tab');
  const tabContents = document.querySelectorAll('.settings-tab-content');

  // Settings tabs functionality
  settingsTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      
      // Update active tab
      settingsTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Update active content
      tabContents.forEach(content => content.classList.remove('active'));
      document.getElementById(tabName + '-tab').classList.add('active');

      // Load content if needed
      if (tabName === 'uploads') {
        loadUserUploads();
      }
    });
  });

  async function loadUserUploads() {
    try {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (!user) return;

      const { data: uploads, error } = await supabaseClient
        .from('wallpapers')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const uploadsList = document.getElementById('user-uploads-list');
      
      if (!uploads || uploads.length === 0) {
        uploadsList.innerHTML = '<p>You haven\'t uploaded any wallpapers yet.</p>';
        return;
      }

      uploadsList.innerHTML = uploads.map(upload => `
        <div class="upload-item">
          <img src="${upload.image_url}" alt="${upload.title}" class="upload-thumbnail">
          <div class="upload-info">
            <h5>${upload.title}</h5>
            <p>${upload.description || 'No description'}</p>
            <small>Category: ${upload.category} | Uploaded: ${new Date(upload.created_at).toLocaleDateString()}</small>
          </div>
          <div class="upload-actions">
            <button class="btn btn-sm btn-secondary" onclick="copyImageUrl('${upload.image_url}')">Copy URL</button>
            <button class="btn btn-sm btn-danger" onclick="deleteUpload('${upload.id}')">Delete</button>
          </div>
        </div>
      `).join('');

    } catch (error) {
      console.error('Error loading uploads:', error);
      document.getElementById('user-uploads-list').innerHTML = '<p>Error loading uploads</p>';
    }
  }

  window.copyImageUrl = function(url) {
    navigator.clipboard.writeText(url).then(() => {
      alert('Image URL copied to clipboard!');
    });
  };

  window.deleteUpload = async function(uploadId) {
    if (!confirm('Are you sure you want to delete this wallpaper?')) return;

    try {
      const { error } = await supabaseClient
        .from('wallpapers')
        .delete()
        .eq('id', uploadId);

      if (error) throw error;

      alert('Wallpaper deleted successfully');
      loadUserUploads();
      loadWallpapers();
    } catch (error) {
      alert('Error deleting wallpaper: ' + error.message);
    }
  };

  // Profile management
  document.getElementById('save-profile-btn')?.addEventListener('click', async () => {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    const bio = document.getElementById('profile-bio').value;

    try {
      const { error } = await supabaseClient
        .from('user_profiles')
        .update({ bio })
        .eq('id', user.id);

      if (error) throw error;
      alert('Profile updated successfully!');
    } catch (error) {
      alert('Error updating profile: ' + error.message);
    }
  });

  if (closeSettings) {
    closeSettings.addEventListener('click', () => {
      settingsPanel.classList.add('hidden');
    });
  }

  if (darkModeToggle) {
    darkModeToggle.addEventListener('change', () => {
      document.body.classList.toggle('dark-mode');
      localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
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
  loadWallpapers();
}

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  initializeApp();
});

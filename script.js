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
    } else {
      document.getElementById('user-name').textContent = user.email;
      document.getElementById('user-email').textContent = user.email;
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

    if (!email || !username || !password) {
      alert('Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      alert('Password must be at least 6 characters long');
      return;
    }

    try {
      // Call backend for signup
      const response = await fetch(`${backendUrl}/api/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, username, password }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      // Success - close modal and show success message
      document.getElementById('signup-modal').classList.add('hidden');
      alert('Account created successfully! You can now log in.');

      // Clear form
      document.getElementById('signup-form').reset();

    } catch (error) {
      alert('Error: ' + error.message);
    }
  });

  // ============ LOGOUT ============
  document.getElementById('logout-btn').addEventListener('click', async () => {
    try {
      // Call backend for signout
      await fetch(`${backendUrl}/api/signout`, {
        method: 'POST',
      });

      // Update UI
      displayAuthButtons();

    } catch (error) {
      console.error('Logout error:', error);
      // Still update UI even if backend call fails
      displayAuthButtons();
    }
  });

  // ============ LOGIN FORM ============
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
      alert('Please enter both email and password');
      return;
    }

    try {
      // Call backend for signin
      const response = await fetch(`${backendUrl}/api/signin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      // Success - close modal and update UI
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

    const title = document.getElementById('upload-title').value;
    const description = document.getElementById('upload-description').value;
    const category = document.getElementById('upload-category').value;
    const tags = document.getElementById('upload-tags').value.split(',').map(t => t.trim());
    const isPublic = document.getElementById('upload-public').checked;

    try {
      // Upload image to storage
      const filePath = `${user.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabaseClient.storage
        .from('wallpapers')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabaseClient.storage
        .from('wallpapers')
        .getPublicUrl(filePath);

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

      alert('Wallpaper uploaded successfully!');
      document.getElementById('upload-modal').classList.add('hidden');
      uploadForm.reset();
      uploadPreview.classList.add('hidden');

      // Refresh the wallpaper gallery
      loadWallpapers();

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
  loadWallpapers();
}

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  initializeApp();
});

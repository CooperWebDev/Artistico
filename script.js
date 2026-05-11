// Wait for Supabase to load, then initialize
function initializeApp() {
  if (typeof window.supabase === 'undefined') {
    // Retry after a short delay
    setTimeout(initializeApp, 100);
    return;
  }

  // Supabase setup - Replace with your actual keys
  const supabaseUrl = 'https://gaaatmmreteqdpsxsvyw.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhYWF0bW1yZXRlcWRwc3hzdnl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MzM4MDgsImV4cCI6MjA5NDAwOTgwOH0.Y6-R5x6xmBSAW7hcpKc9uHcfNQ739ajnxghmbug45t8';
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
  const userTrigger = document.getElementById('user-trigger');

  let allWallpapers = [];
  let userLikes = new Set();

  async function loadUserLikes() {
    const userData = localStorage.getItem('user');
    if (!userData) {
      userLikes = new Set();
      return;
    }
    const user = JSON.parse(userData);
    try {
      const { data, error } = await supabaseClient
        .from('user_likes')
        .select('wallpaper_id')
        .eq('user_id', user.id);
      if (error) throw error;
      userLikes = new Set(data.map(like => like.wallpaper_id));
    } catch (error) {
      console.error('Error loading likes:', error);
      userLikes = new Set();
    }
  }

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

  async function toggleLike(event) {
    event.stopPropagation();
    const userData = localStorage.getItem('user');
    if (!userData) {
      alert('Please log in to like wallpapers');
      return;
    }
    const user = JSON.parse(userData);
    const wallpaperId = event.currentTarget.dataset.id;

    try {
      // Check if liked
      const { data: existingLike, error: selectError } = await supabaseClient
        .from('user_likes')
        .select('id')
        .eq('user_id', user.id)
        .eq('wallpaper_id', wallpaperId)
        .single();

      let isLiked = !selectError && existingLike;

      if (isLiked) {
        // Unlike
        const { error } = await supabaseClient
          .from('user_likes')
          .delete()
          .eq('user_id', user.id)
          .eq('wallpaper_id', wallpaperId);
        if (error) throw error;
        userLikes.delete(wallpaperId);
      } else {
        // Like
        const { error } = await supabaseClient
          .from('user_likes')
          .insert({ user_id: user.id, wallpaper_id: wallpaperId });
        if (error) throw error;
        userLikes.add(wallpaperId);
      }

      // Update likes_count
      const increment = isLiked ? -1 : 1;
      const { error: updateError } = await supabaseClient
        .from('wallpapers')
        .update({ likes_count: supabaseClient.raw(`likes_count + ${increment}`) })
        .eq('id', wallpaperId);
      if (updateError) throw updateError;

      // Update UI
      const likesCountEl = event.currentTarget.nextElementSibling;
      likesCountEl.textContent = parseInt(likesCountEl.textContent) + increment;
      event.currentTarget.classList.toggle('liked', !isLiked);

    } catch (error) {
      console.error('Like error:', error);
      alert('Error updating like');
    }
  }

  // ============ CREATE WALLPAPER CARD ============
  function createWallpaperCard(wallpaper) {
    const card = document.createElement('article');
    card.className = 'photo-card';
    card.dataset.tags = (wallpaper.tags || []).join(' ') + ' ' + (wallpaper.category || 'nature');
    card.dataset.id = wallpaper.id;

    const img = document.createElement('img');
    img.src = wallpaper.image_url;
    img.alt = wallpaper.title;
    img.loading = 'lazy';

    const overlay = document.createElement('div');
    overlay.className = 'photo-overlay';

    const title = document.createElement('h3');
    title.textContent = wallpaper.title;

    const actions = document.createElement('div');
    actions.className = 'photo-actions';

    const likeBtn = document.createElement('button');
    likeBtn.className = 'like-btn';
    if (userLikes.has(wallpaper.id)) likeBtn.classList.add('liked');
    likeBtn.innerHTML = '<i class="fas fa-heart"></i>';
    likeBtn.dataset.id = wallpaper.id;
    likeBtn.addEventListener('click', toggleLike);

    const likesCount = document.createElement('span');
    likesCount.className = 'likes-count';
    likesCount.textContent = wallpaper.likes_count || 0;

    actions.appendChild(likeBtn);
    actions.appendChild(likesCount);

    overlay.appendChild(title);
    overlay.appendChild(actions);

    card.appendChild(img);
    card.appendChild(overlay);
    return card;
  }

  // ============ FILTER WALLPAPERS ============
  function filterWallpapers(query, category) {
    const searchTerm = query.toLowerCase().trim();

    const filteredWallpapers = allWallpapers.filter(wallpaper => {
      const tags = ((wallpaper.tags || []).join(' ') + ' ' + (wallpaper.category || 'nature')).toLowerCase();
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
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      await loadUserLikes();
      await displayUserMenu(user);
    } else {
      userLikes = new Set();
      displayAuthButtons();
    }
  }

  function displayAuthButtons() {
    document.getElementById('signup-btn').classList.remove('hidden');
    document.getElementById('login-btn').classList.remove('hidden');
    document.getElementById('user-menu').classList.add('hidden');
    userTrigger?.classList.add('hidden');
    userMenuOpen = false;
  }

  async function displayUserMenu(user) {
    document.getElementById('signup-btn').classList.add('hidden');
    document.getElementById('login-btn').classList.add('hidden');
    userTrigger?.classList.remove('hidden');
    document.getElementById('user-menu').classList.add('hidden');
    userMenuOpen = false;
    
    // Trigger avatar
    const triggerAvatarImg = document.getElementById('trigger-avatar');
    const triggerAvatarContainer = triggerAvatarImg.parentElement;
    if (user.avatar_url) {
      triggerAvatarImg.src = user.avatar_url;
      triggerAvatarImg.style.display = 'block';
      const letterDiv = triggerAvatarContainer.querySelector('.avatar-letter');
      if (letterDiv) letterDiv.remove();
    } else {
      triggerAvatarImg.style.display = 'none';
      let letterDiv = triggerAvatarContainer.querySelector('.avatar-letter');
      if (!letterDiv) {
        letterDiv = document.createElement('div');
        letterDiv.className = 'avatar-letter';
        triggerAvatarContainer.insertBefore(letterDiv, triggerAvatarImg.nextSibling);
      }
      const firstLetter = (user.username || user.email || 'U').charAt(0).toUpperCase();
      letterDiv.textContent = firstLetter;
      const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];
      letterDiv.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    }

    document.getElementById('trigger-name').textContent = user.username || user.email;
    document.getElementById('trigger-email').textContent = user.email;

    // Dropdown content
    const avatarImg = document.getElementById('user-avatar');
    const avatarContainer = avatarImg.parentElement;
    if (user.avatar_url) {
      avatarImg.src = user.avatar_url;
      avatarImg.style.display = 'block';
      const letterDiv = avatarContainer.querySelector('.avatar-letter');
      if (letterDiv) letterDiv.remove();
    } else {
      avatarImg.style.display = 'none';
      let letterDiv = avatarContainer.querySelector('.avatar-letter');
      if (!letterDiv) {
        letterDiv = document.createElement('div');
        letterDiv.className = 'avatar-letter';
        avatarContainer.insertBefore(letterDiv, avatarImg.nextSibling);
      }
      const firstLetter = (user.username || user.email || 'U').charAt(0).toUpperCase();
      letterDiv.textContent = firstLetter;
      const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];
      letterDiv.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    }

    document.getElementById('user-name').textContent = user.username || user.email;
    document.getElementById('user-email').textContent = user.email;

    document.getElementById('profile-username-input').value = user.username || '';
    document.getElementById('profile-email').textContent = user.email;
    if (user.avatar_url) {
      document.getElementById('profile-avatar').src = user.avatar_url;
    }
    if (user.bio) {
      document.getElementById('profile-bio').value = user.bio;
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

      // Insert directly into user_profiles
      const { data, error } = await supabaseClient
        .from('user_profiles')
        .insert({
          email,
          username,
          password, // Plain text for simplicity (not secure)
          is_verified: true,
        })
        .select()
        .single();

      if (error) throw error;

      // Store user in localStorage
      localStorage.setItem('user', JSON.stringify(data));

      document.getElementById('signup-modal').classList.add('hidden');
      errorDiv.style.display = 'none';
      alert('Account created successfully! You can now log in.');
      document.getElementById('signup-form').reset();

      // Update UI
      await displayUserMenu(data);

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
    localStorage.removeItem('user');
    displayAuthButtons();
    document.getElementById('user-menu').classList.add('hidden');
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

      // Query user_profiles for matching email and password
      const { data, error } = await supabaseClient
        .from('user_profiles')
        .select('*')
        .eq('email', email)
        .eq('password', password)
        .single();

      if (error || !data) throw new Error('Invalid email or password');

      // Store user in localStorage
      localStorage.setItem('user', JSON.stringify(data));

      // Success - close modal and update UI
      document.getElementById('login-modal').classList.add('hidden');
      await displayUserMenu(data);

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
  
  // Toggle user menu when clicking on profile trigger
  userTrigger?.addEventListener('click', (e) => {
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

  // Favorites button in user menu
  document.getElementById('favorites-btn')?.addEventListener('click', () => {
    const settingsPanel = document.getElementById('settings-panel');
    settingsPanel.classList.remove('hidden');
    
    // Switch to favorites tab
    document.querySelectorAll('.settings-tab').forEach(tab => {
      tab.classList.remove('active');
      if (tab.dataset.tab === 'favorites') {
        tab.classList.add('active');
      }
    });
    
    document.querySelectorAll('.settings-tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById('favorites-tab').classList.add('active');
    
    loadUserFavorites();
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
    
    const userData = localStorage.getItem('user');
    if (!userData) {
      alert('You must be logged in to upload');
      return;
    }
    const user = JSON.parse(userData);

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
      } else if (tabName === 'favorites') {
        loadUserFavorites();
      }
    });
  });

  async function loadUserFavorites() {
    const userData = localStorage.getItem('user');
    if (!userData) return;
    const user = JSON.parse(userData);

    try {
      const { data: likes, error } = await supabaseClient
        .from('user_likes')
        .select('wallpaper_id')
        .eq('user_id', user.id);

      if (error) throw error;

      if (!likes || likes.length === 0) {
        document.getElementById('user-favorites-list').innerHTML = '<p>You haven\'t liked any wallpapers yet.</p>';
        return;
      }

      const wallpaperIds = likes.map(like => like.wallpaper_id);
      const { data: wallpapers, error: wpError } = await supabaseClient
        .from('wallpapers')
        .select('*')
        .in('id', wallpaperIds);

      if (wpError) throw wpError;

      document.getElementById('user-favorites-list').innerHTML = wallpapers.map(wallpaper => `
        <div class="upload-item">
          <img src="${wallpaper.image_url}" alt="${wallpaper.title}" class="upload-thumbnail">
          <div class="upload-info">
            <h5>${wallpaper.title}</h5>
            <p>${wallpaper.description || 'No description'}</p>
            <small>Category: ${wallpaper.category} | Likes: ${wallpaper.likes_count || 0}</small>
          </div>
          <div class="upload-actions">
            <button class="btn btn-sm btn-secondary" onclick="copyImageUrl('${wallpaper.image_url}')">Copy URL</button>
          </div>
        </div>
      `).join('');

    } catch (error) {
      console.error('Error loading favorites:', error);
      document.getElementById('user-favorites-list').innerHTML = '<p>Error loading favorites</p>';
    }
  }

  async function loadUserUploads() {
    const userData = localStorage.getItem('user');
    if (!userData) return;
    const user = JSON.parse(userData);

    try {
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
    const userData = localStorage.getItem('user');
    if (!userData) return;
    const user = JSON.parse(userData);

    const username = document.getElementById('profile-username-input').value.trim();
    const bio = document.getElementById('profile-bio').value;
    const avatarFile = document.getElementById('profile-avatar-upload').files[0];

    let avatarUrl = user.avatar_url;

    if (avatarFile) {
      // Upload avatar
      const filePath = `avatars/${user.id}/${Date.now()}-${avatarFile.name}`;
      const { error: uploadError } = await supabaseClient.storage
        .from('wallpapers')
        .upload(filePath, avatarFile);

      if (uploadError) {
        alert('Avatar upload failed: ' + uploadError.message);
        return;
      }

      const { data: { publicUrl } } = supabaseClient.storage
        .from('wallpapers')
        .getPublicUrl(filePath);

      avatarUrl = publicUrl;
    }

    try {
      const { error } = await supabaseClient
        .from('user_profiles')
        .update({ username, bio, avatar_url: avatarUrl })
        .eq('id', user.id);

      if (error) throw error;

      // Update localStorage
      user.username = username;
      user.bio = bio;
      user.avatar_url = avatarUrl;
      localStorage.setItem('user', JSON.stringify(user));

      // Update display
      displayUserMenu(user);

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

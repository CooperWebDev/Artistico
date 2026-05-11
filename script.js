// Wait for Supabase to load, then initialize
async function initializeApp() {
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
  const navbarPageLabel = document.getElementById('navbar-page-label');
  const navbarPageTitle = document.getElementById('navbar-page-title');
  const chips = document.querySelectorAll('.chip');
  const sidebarLinks = document.querySelectorAll('.sidebar-link');
  const filterBtn = document.querySelector('.icon-action[title="Reset filter"]');
  const galleryGrid = document.getElementById('wallpapers');
  const loadingState = document.getElementById('loading-wallpapers');
  const emptyState = document.getElementById('no-wallpapers');
  const userTrigger = document.getElementById('user-trigger');

  const pages = ['home', 'upload-page', 'favorites-page', 'my-uploads-page', 'profile-page'];

  let allWallpapers = [];
  let userLikes = new Set();
  let userMenuOpen = false;

  function updateNavbarTitle(pageId) {
    const titles = {
      'home': { label: 'Wallpapers', title: 'Curated wallpapers for your device' },
      'upload-page': { label: 'Upload', title: 'Share your artwork with the community' },
      'favorites-page': { label: 'Favorites', title: 'Your favorite wallpapers' },
      'my-uploads-page': { label: 'My Uploads', title: 'Your uploaded wallpapers' },
      'profile-page': { label: 'Profile', title: 'Manage your account' },
    };
    const pageData = titles[pageId] || titles.home;
    navbarPageLabel && (navbarPageLabel.textContent = pageData.label);
    navbarPageTitle && (navbarPageTitle.textContent = pageData.title);
  }

  function showPage(pageId) {
    pages.forEach(id => {
      const page = document.getElementById(id);
      if (!page) return;
      page.classList.toggle('hidden', id !== pageId);
    });
    document.getElementById('user-menu')?.classList.add('hidden');
    userMenuOpen = false;
    updateNavbarTitle(pageId);
  }

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
    const wallpaperId = event.currentTarget.dataset.id;

    try {
      await updateLike(wallpaperId);
    } catch (error) {
      console.error('Like error:', error);
      alert('Error updating like');
    }
  }

  async function updateLike(wallpaperId) {
    const userData = localStorage.getItem('user');
    if (!userData) {
      alert('Please log in to like wallpapers');
      return;
    }
    const user = JSON.parse(userData);

    const { data: existingLike, error: selectError } = await supabaseClient
      .from('user_likes')
      .select('user_id')
      .eq('user_id', user.id)
      .eq('wallpaper_id', wallpaperId)
      .single();

    let isLiked = false;
    if (selectError && selectError.code !== 'PGRST116') {
      throw selectError;
    }
    isLiked = !selectError && existingLike;

    if (isLiked) {
      const { error } = await supabaseClient
        .from('user_likes')
        .delete()
        .eq('user_id', user.id)
        .eq('wallpaper_id', wallpaperId);
      if (error) throw error;
      userLikes.delete(wallpaperId);
    } else {
      const { error } = await supabaseClient
        .from('user_likes')
        .insert({ user_id: user.id, wallpaper_id: wallpaperId });
      if (error) throw error;
      userLikes.add(wallpaperId);
    }

    const { data: wallpaper } = await supabaseClient
      .from('wallpapers')
      .select('likes_count')
      .eq('id', wallpaperId)
      .single();

    const increment = isLiked ? -1 : 1;
    const newCount = Math.max(0, (wallpaper?.likes_count || 0) + increment);
    const { error: updateError } = await supabaseClient
      .from('wallpapers')
      .update({ likes_count: newCount })
      .eq('id', wallpaperId);
    if (updateError) throw updateError;

    syncLikeUI(wallpaperId, !isLiked, newCount);
  }

  function syncLikeUI(wallpaperId, isLiked, newCount) {
    const cardButtons = document.querySelectorAll(`button.like-btn[data-id="${wallpaperId}"]`);
    cardButtons.forEach(btn => {
      btn.classList.toggle('liked', isLiked);
      const countEl = btn.nextElementSibling;
      if (countEl) {
        countEl.textContent = newCount;
      }
    });

    const detailLikeBtn = document.getElementById('detail-like-btn');
    if (detailLikeBtn?.dataset.wallpaperId === wallpaperId) {
      detailLikeBtn.classList.toggle('liked', isLiked);
      document.getElementById('detail-likes-count').textContent = newCount;
    }

    const wallpaper = allWallpapers.find(w => w.id === wallpaperId);
    if (wallpaper) {
      wallpaper.likes_count = newCount;
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
    img.addEventListener('click', () => openWallpaperDetail(wallpaper.id));
    img.style.cursor = 'pointer';

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

  // ============ WALLPAPER DETAIL MODAL ============
  async function openWallpaperDetail(wallpaperId) {
    try {
      // Get wallpaper details
      const { data: wallpaper, error } = await supabaseClient
        .from('wallpapers')
        .select('*')
        .eq('id', wallpaperId)
        .single();

      if (error) throw error;
      if (!wallpaper) throw new Error('Wallpaper not found');

      // Get creator profile
      const { data: creator, error: creatorError } = await supabaseClient
        .from('user_profiles')
        .select('*')
        .eq('id', wallpaper.user_id)
        .single();

      if (creatorError) console.error('Error loading creator:', creatorError);

      // Populate modal
      document.getElementById('detail-image').src = wallpaper.image_url;
      document.getElementById('detail-title').textContent = wallpaper.title;
      document.getElementById('detail-description').textContent = wallpaper.description || 'No description provided';
      document.getElementById('detail-category').textContent = wallpaper.category || 'Uncategorized';
      document.getElementById('detail-date').textContent = new Date(wallpaper.created_at).toLocaleDateString();
      document.getElementById('detail-likes-count').textContent = wallpaper.likes_count || 0;

      const tagsContainer = document.getElementById('detail-tags');
      if (wallpaper.tags && wallpaper.tags.length > 0) {
        tagsContainer.innerHTML = wallpaper.tags.map(tag => `<span>${tag}</span>`).join('');
      } else {
        tagsContainer.innerHTML = '';
      }

      if (creator) {
        document.getElementById('creator-avatar').src = creator.avatar_url || 'https://via.placeholder.com/60?text=Avatar';
        document.getElementById('creator-name').textContent = creator.username || creator.email;
        document.getElementById('creator-bio').textContent = creator.bio || 'No bio provided';
      }

      const likeBtn = document.getElementById('detail-like-btn');
      likeBtn.dataset.wallpaperId = wallpaperId;
      likeBtn.classList.toggle('liked', userLikes.has(wallpaperId));

      window.currentCreatorId = wallpaper.user_id;
      document.getElementById('wallpaper-detail-modal').classList.remove('hidden');

    } catch (error) {
      console.error('Error opening wallpaper detail:', error);
      alert('Error loading wallpaper details');
    }
  }

  function setupDetailModalListeners() {
    const modal = document.getElementById('wallpaper-detail-modal');
    const closeBtn = modal.querySelector('.modal-close');
    const likeBtn = document.getElementById('detail-like-btn');
    const downloadBtn = document.getElementById('detail-download-btn');
    const viewCreatorBtn = document.getElementById('view-creator-work-btn');

    closeBtn.addEventListener('click', () => {
      modal.classList.add('hidden');
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
      }
    });

    likeBtn.addEventListener('click', async () => {
      const wallpaperId = likeBtn.dataset.wallpaperId;
      if (!wallpaperId) return;

      try {
        await updateLike(wallpaperId);
      } catch (error) {
        console.error('Like error:', error);
        alert('Error updating like');
      }
    });

    downloadBtn.addEventListener('click', () => {
      const img = document.getElementById('detail-image');
      const link = document.createElement('a');
      link.href = img.src;
      link.download = 'wallpaper';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });

    viewCreatorBtn.addEventListener('click', () => {
      modal.classList.add('hidden');
      filterWallpapersByCreator(window.currentCreatorId);
    });
  }

  function filterWallpapersByCreator(creatorId) {
    const creatorWallpapers = allWallpapers.filter(w => w.user_id === creatorId);
    if (creatorWallpapers.length === 0) {
      document.getElementById('no-wallpapers').style.display = 'block';
      document.getElementById('wallpapers').innerHTML = '';
      return;
    }
    displayWallpapers(creatorWallpapers);
    showPage('home');
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

  async function showNotifications() {
    const userData = localStorage.getItem('user');
    if (!userData) {
      alert('Please log in to see notifications.');
      return;
    }

    const user = JSON.parse(userData);
    try {
      const { data: wallpapers, error: wallpapersError } = await supabaseClient
        .from('wallpapers')
        .select('id,title')
        .eq('user_id', user.id);
      if (wallpapersError) throw wallpapersError;

      const notificationsList = document.getElementById('notifications-list');
      const emptyMessage = document.getElementById('notifications-empty-message');
      const modalTitle = document.getElementById('notifications-modal-title');

      if (!wallpapers || wallpapers.length === 0) {
        modalTitle.textContent = 'Notifications';
        notificationsList.innerHTML = '';
        emptyMessage.textContent = 'You have no uploads yet, so there are no notifications.';
        emptyMessage.classList.remove('hidden');
        openNotificationsModal();
        return;
      }

      const wallpaperIds = wallpapers.map(w => w.id);
      const { data: likes, error: likesError } = await supabaseClient
        .from('user_likes')
        .select('wallpaper_id')
        .in('wallpaper_id', wallpaperIds)
        .neq('user_id', user.id);
      if (likesError) throw likesError;

      const countByWallpaper = likes?.reduce((acc, like) => {
        acc[like.wallpaper_id] = (acc[like.wallpaper_id] || 0) + 1;
        return acc;
      }, {}) || {};

      const notifications = wallpapers
        .filter(w => countByWallpaper[w.id])
        .map(w => ({ title: w.title, count: countByWallpaper[w.id] }))
        .sort((a, b) => b.count - a.count);

      modalTitle.textContent = 'Notifications';
      if (!notifications.length) {
        notificationsList.innerHTML = '';
        emptyMessage.textContent = 'No new likes on your wallpapers yet.';
        emptyMessage.classList.remove('hidden');
      } else {
        emptyMessage.classList.add('hidden');
        notificationsList.innerHTML = notifications.map(note => `
          <div class="notification-item">
            <strong>${note.count}</strong> like(s) on <em>${note.title}</em>
          </div>
        `).join('');
      }

      openNotificationsModal();
    } catch (error) {
      console.error('Notification error:', error);
      alert('Unable to load notifications right now.');
    }
  }

  function openNotificationsModal() {
    document.getElementById('notifications-modal')?.classList.remove('hidden');
  }

  function setupNotificationsModalListeners() {
    const modal = document.getElementById('notifications-modal');
    const closeBtn = document.getElementById('notifications-close-btn');

    closeBtn?.addEventListener('click', () => {
      modal.classList.add('hidden');
    });

    modal?.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
      }
    });
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

    const profileAvatarImg = document.getElementById('profile-avatar');
    if (profileAvatarImg) {
      if (user.avatar_url) {
        profileAvatarImg.src = user.avatar_url;
        profileAvatarImg.style.display = 'block';
      } else {
        profileAvatarImg.style.display = 'block';
      }
    }

    const usernameInput = document.getElementById('profile-username-input');
    if (usernameInput) usernameInput.value = user.username || '';
    const profileEmail = document.getElementById('profile-email');
    if (profileEmail) profileEmail.textContent = user.email;
    const profileBio = document.getElementById('profile-bio');
    if (profileBio) profileBio.value = user.bio || '';
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
      const defaultChip = document.querySelector('.chip[data-filter="all"]');
      if (defaultChip) {
        setActiveChip(defaultChip);
      }
      filterWallpapers(searchInput.value, activeFilter);
      searchInput.focus();
    });
  }

  sidebarLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const action = this.dataset.action;
      sidebarLinks.forEach(el => el.classList.remove('active'));
      this.classList.add('active');

      if (action === 'home') {
        showPage('home');
      } else if (action === 'notifications') {
        showNotifications();
      } else if (action === 'upload') {
        showPage('upload-page');
      } else if (action === 'favorites') {
        showPage('favorites-page');
        loadUserFavorites();
      } else if (action === 'profile') {
        showPage('my-uploads-page');
        loadUserUploads();
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

  // My Uploads button in user menu
  document.getElementById('my-uploads-btn')?.addEventListener('click', () => {
    showPage('profile-page');
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
        showPage('home');
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

  async function removeLike(wallpaperId) {
    const userData = localStorage.getItem('user');
    if (!userData) return;
    const user = JSON.parse(userData);

    try {
      const { error } = await supabaseClient
        .from('user_likes')
        .delete()
        .eq('user_id', user.id)
        .eq('wallpaper_id', wallpaperId);
      if (error) throw error;

      // Update likes count
      const { data: wallpaper } = await supabaseClient
        .from('wallpapers')
        .select('likes_count')
        .eq('id', wallpaperId)
        .single();
      const newCount = Math.max(0, (wallpaper?.likes_count || 0) - 1);
      await supabaseClient
        .from('wallpapers')
        .update({ likes_count: newCount })
        .eq('id', wallpaperId);

      // Reload favorites
      loadUserFavorites();
    } catch (error) {
      console.error('Error removing like:', error);
      alert('Error removing like');
    }
  }

  async function deleteUpload(wallpaperId) {
    if (!confirm('Are you sure you want to delete this wallpaper? This action cannot be undone.')) return;

    try {
      const { error } = await supabaseClient
        .from('wallpapers')
        .delete()
        .eq('id', wallpaperId);
      if (error) throw error;

      // Reload uploads
      loadUserUploads();
    } catch (error) {
      console.error('Error deleting upload:', error);
      alert('Error deleting wallpaper');
    }
  }

  // Make functions global for onclick
  window.removeLike = removeLike;
  window.deleteUpload = deleteUpload;
  window.copyImageUrl = (url) => {
    navigator.clipboard.writeText(url).then(() => {
      alert('Image URL copied to clipboard!');
    }).catch(() => {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('Image URL copied to clipboard!');
    });
  };

  // Initialize
  await checkAuthStatus();
  await loadWallpapers();
  updateNavbarTitle('home');
  setupDetailModalListeners();
  setupNotificationsModalListeners();
}

// Start the app when DOM is ready
 document.addEventListener('DOMContentLoaded', function() {
  initializeApp();
 });

/**
 * FBGroupMaster
 * JavaScript file for the popup window
 */

// Global variables
let posts = [];
let groups = [];
let selectedGroups = [];
let collections = [];
let currentCollection = 'all';
let modalCurrentCollection = 'all'; // Variable to track the selected collection in the modal
let editingPostIndex = -1;
let editingPostImagesMode = false;
let postInterval;
let currentGroupIndex = 0;
let totalPostCount = 0;
let currentPostCount = 0;
let countdownTimer;
let isPosting = false;
let statusCheckInterval = null;
let currentImages = []; // Array to store current images
let currentEditPostId = null; // ID of the post being edited

// Initialize the popup state when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Initialize tabs instead of missing initializeStyles function
  initTabs();
  loadCollections();
  loadGroups();
  loadScheduledPosts();
  setupEventListeners();
  setupCollectionEventListeners();
  
  // Set up window styling and buttons
  addButtonStyles();
  
  // Check posting status on load
  initializePopupState();
  
  // Handle window close button
  document.getElementById('close-window').addEventListener('click', function() {
    window.close();
  });
});

/**
 * Initialize popup state when opened
 */
function initializePopupState() {
  // Check if posting is running in background
  checkPostingStatus();
  
  // Initialize the scheduling section
  initializeScheduleSection();
  
  // Setup collection event listeners
  setupCollectionEventListeners();
  
  // Set an interval to periodically check the posting status
  if (!statusCheckInterval) {
    statusCheckInterval = setInterval(checkPostingStatus, 1000);
  }
}

/**
 * Initialize tabs
 */
function initTabs() {
  const tabs = document.querySelectorAll('.nav-tab');
  const tabContents = document.querySelectorAll('.tab-content');
  
  // Add click event to each tab
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active class from all tabs
      tabs.forEach(t => t.classList.remove('active'));
      
      // Add active class to clicked tab
      tab.classList.add('active');
      
      // Hide all tab contents
      tabContents.forEach(content => content.classList.remove('active'));
      
      // Show content for clicked tab
      const tabName = tab.getAttribute('data-tab');
      const tabContent = document.getElementById(`${tabName}-tab`);
      if (tabContent) {
        tabContent.classList.add('active');
      }
    });
  });
  
  // Also initialize modal tabs
  const modalTabs = document.querySelectorAll('[data-modal-tab]');
  if (modalTabs && modalTabs.length > 0) {
    modalTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        // Remove active class from all tabs
        modalTabs.forEach(t => t.classList.remove('active'));
        
        // Add active class to clicked tab
        tab.classList.add('active');
        
        // Hide all modal tab contents
        const modalTabContents = document.querySelectorAll('.modal-tab-content');
        if (modalTabContents) {
          modalTabContents.forEach(content => {
            if (content) {
              content.style.display = 'none';
            }
          });
        }
        
        // Show content for clicked tab
        const tabName = tab.getAttribute('data-modal-tab');
        const modalTabContent = document.getElementById(`${tabName}-tab`);
        if (modalTabContent) {
          modalTabContent.style.display = 'block';
        }
      });
    });
  }
  
  // Show scheduling section properly
  const scheduleSection = document.getElementById('schedule-section');
  if (scheduleSection) {
    scheduleSection.style.display = 'block';
  }
}

/**
 * Load collections from storage
 */
function loadCollections() {
  chrome.storage.local.get(['groupCollections'], result => {
    if (result.groupCollections && result.groupCollections.length > 0) {
      collections = result.groupCollections;
    } else {
      collections = [];
    }
    
    // Populate collection dropdowns
    populateCollectionDropdowns();
  });
}

/**
 * Populate collection dropdowns
 */
function populateCollectionDropdowns() {
  const selects = [
    document.getElementById('group-collection-select'),
    document.getElementById('group-collection'),
    document.getElementById('bulk-collection')
  ];
  
  selects.forEach(select => {
    if (!select) return;
    
    // Clear existing options except first one
    while (select.options.length > 1) {
      select.remove(1);
    }
    
    // Add collections
    collections.forEach(collection => {
      const option = document.createElement('option');
      option.value = collection.id;
      option.textContent = collection.name;
      select.appendChild(option);
    });
  });
}

/**
 * Load groups from storage
 */
function loadGroups() {
  chrome.storage.local.get(['fbGroups'], result => {
    if (result.fbGroups && result.fbGroups.length > 0) {
      groups = result.fbGroups;
      renderGroups();
    } else {
      document.getElementById('no-groups').style.display = 'block';
    }
    
    // Load previously selected groups
    chrome.storage.local.get(['selectedGroups'], result => {
      if (result.selectedGroups && result.selectedGroups.length > 0) {
        selectedGroups = result.selectedGroups;
        updateSelectedGroupsCount();
      }
    });
  });
}

/**
 * Load scheduled posts
 */
function loadScheduledPosts() {
  chrome.runtime.sendMessage({ action: "getScheduledPosts" }, response => {
    if (response && response.success) {
      renderScheduledPosts(response.scheduledPosts);
    }
  });
}

/**
 * Setup event listeners for buttons and controls
 */
function setupEventListeners() {
  // Image upload
  const imageUpload = document.getElementById('image-upload');
  if (imageUpload) {
    imageUpload.addEventListener('change', handleImageUpload);
  }
  
  // Clear images button
  const clearImagesBtn = document.getElementById('clear-images-btn');
  if (clearImagesBtn) {
    clearImagesBtn.addEventListener('click', clearImages);
  }
  
  // Post content button
  const postNowBtn = document.getElementById('post-now-btn');
  if (postNowBtn) {
    postNowBtn.addEventListener('click', postContent);
  }
  
  // Stop posting button
  const stopPostingBtn = document.getElementById('stop-posting-btn');
  if (stopPostingBtn) {
    stopPostingBtn.addEventListener('click', stopPosting);
  }
  
  // Multiple posts toggle
  const enableMultiplePosts = document.getElementById('enable-multiple-posts');
  if (enableMultiplePosts) {
    enableMultiplePosts.addEventListener('change', function() {
    const multiplePostsSection = document.getElementById('multiple-posts-section');
      if (multiplePostsSection) {
        multiplePostsSection.style.display = this.checked ? 'block' : 'none';
      }
    });
  }
  
  // Add new post button
  const addPostBtn = document.getElementById('add-post-btn');
  if (addPostBtn) {
    addPostBtn.addEventListener('click', addNewPost);
  }
  
  // Group selection controls
  const selectGroupsBtn = document.getElementById('select-groups-btn');
  if (selectGroupsBtn) {
    selectGroupsBtn.addEventListener('click', openGroupsModal);
  }
  
  // Groups modal controls
  const closeModalBtn = document.getElementById('close-groups-modal');
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', closeGroupsModal);
  }
  
  const confirmGroupSelectionBtn = document.getElementById('confirm-group-selection');
  if (confirmGroupSelectionBtn) {
    confirmGroupSelectionBtn.addEventListener('click', confirmGroupSelection);
  }
  
  const cancelGroupSelection = document.getElementById('cancel-group-selection');
  if (cancelGroupSelection) {
    cancelGroupSelection.addEventListener('click', closeGroupsModal);
  }
  
  // Modal collection filter dropdown
  const modalGroupCollectionSelect = document.getElementById('modal-group-collection-select');
  if (modalGroupCollectionSelect) {
    modalGroupCollectionSelect.addEventListener('change', function() {
      modalCurrentCollection = this.value;
      renderModalGroups();
    });
  }
  
  // Modal select/deselect all buttons
  const modalSelectAllGroupsBtn = document.getElementById('modal-select-all-groups-btn');
  if (modalSelectAllGroupsBtn) {
    modalSelectAllGroupsBtn.addEventListener('click', selectAllModalGroups);
  }
  
  const modalDeselectAllGroupsBtn = document.getElementById('modal-deselect-all-groups-btn');
  if (modalDeselectAllGroupsBtn) {
    modalDeselectAllGroupsBtn.addEventListener('click', deselectAllModalGroups);
  }
  
  // Group search filter
  const groupSearch = document.getElementById('group-search');
  if (groupSearch) {
    groupSearch.addEventListener('input', filterGroups);
  }
  
  // Enable group actions
  const refreshGroupsBtn = document.getElementById('refresh-groups-btn');
  if (refreshGroupsBtn) {
    refreshGroupsBtn.addEventListener('click', refreshGroups);
  }
  
  const selectAllGroupsBtn = document.getElementById('select-all-groups-btn');
  if (selectAllGroupsBtn) {
    selectAllGroupsBtn.addEventListener('click', selectAllGroups);
  }
  
  const deselectAllGroupsBtn = document.getElementById('deselect-all-groups-btn');
  if (deselectAllGroupsBtn) {
    deselectAllGroupsBtn.addEventListener('click', deselectAllGroups);
  }
  
  const saveSelectedGroupsBtn = document.getElementById('save-selected-groups-btn');
  if (saveSelectedGroupsBtn) {
    saveSelectedGroupsBtn.addEventListener('click', saveSelectedGroups);
  }
  
  // Group collection selector
  const groupCollectionSelect = document.getElementById('group-collection-select');
  if (groupCollectionSelect) {
    groupCollectionSelect.addEventListener('change', function() {
      currentCollection = this.value;
      renderGroups();
    });
  }
  
  // Add Group Manually button (only sets up the click to open modal)
  const addGroupManuallyBtn = document.getElementById('add-group-manually-btn');
  if (addGroupManuallyBtn) {
    addGroupManuallyBtn.addEventListener('click', openAddGroupModal);
  }
  
  // Collection Management button (only sets up the click to open modal)
  const manageCollectionsBtn = document.getElementById('manage-collections-btn');
  if (manageCollectionsBtn) {
    manageCollectionsBtn.addEventListener('click', openCollectionsModal);
  }
  
  // Pause settings toggle
  const enablePause = document.getElementById('enable-pause');
  const pauseSettings = document.getElementById('pause-settings');
  
  if (enablePause && pauseSettings) {
    enablePause.addEventListener('change', function() {
      pauseSettings.style.display = this.checked ? 'block' : 'none';
    });
  }
  
  // Scheduling section toggle and button
  const schedulePostBtn = document.getElementById('schedule-post-btn');
  if (schedulePostBtn) {
    schedulePostBtn.addEventListener('click', schedulePost);
  }

  // Toggle schedule section visibility
  const enableScheduling = document.getElementById('enable-scheduling');
  const schedulingOptions = document.getElementById('scheduling-options');
  
  if (enableScheduling && schedulingOptions) {
    enableScheduling.addEventListener('change', function() {
      schedulingOptions.style.display = this.checked ? 'block' : 'none';
    });
  }
  
  // Schedule button click event
  const scheduleBtn = document.getElementById('schedule-btn');
  if (scheduleBtn) {
    scheduleBtn.addEventListener('click', schedulePost);
  }
  
  // Recurring toggle
  const enableRecurring = document.getElementById('enable-recurring');
  const recurringOptions = document.getElementById('recurring-options');
  
  if (enableRecurring && recurringOptions) {
    enableRecurring.addEventListener('change', function() {
      recurringOptions.style.display = this.checked ? 'block' : 'none';
    });
  }
}

/**
 * Validate interval inputs to ensure min is less than max
 */
function validateIntervals() {
  const minInterval = parseInt(document.getElementById('post-interval-min').value);
  const maxInterval = parseInt(document.getElementById('post-interval-max').value);
  
  if (minInterval > maxInterval) {
    document.getElementById('post-interval-max').value = minInterval;
  }
  
  if (minInterval < 10) {
    document.getElementById('post-interval-min').value = 10;
  }
  
  if (maxInterval < 10) {
    document.getElementById('post-interval-max').value = 10;
  }
}

/**
 * Check current posting status
 */
function checkPostingStatus() {
  chrome.runtime.sendMessage({ action: "getPostingStatus" }, response => {
    if (response && response.isPosting) {
      // Update posting flag
      isPosting = true;
      
      // Show posting status
      const statusDiv = document.getElementById('posting-status');
      if (statusDiv) statusDiv.style.display = 'block';
      
      // Show stop button
      const stopBtn = document.getElementById('stop-posting-btn');
      if (stopBtn) stopBtn.style.display = 'block';
      
      // Disable post now button
      const postNowBtn = document.getElementById('post-now-btn');
      if (postNowBtn) postNowBtn.disabled = true;
      
      // Update progress
      updatePostingUI(response.postsCompleted, response.totalPosts);
      
      // Update status message and countdown timer
      const statusMsg = document.getElementById('status-message');
      const countdownTimer = document.getElementById('countdown-timer');
      
      if (statusMsg) {
        // Get the base status message
        let statusText = response.statusMessage || 'Posting in progress...';
        statusMsg.textContent = statusText;
      }
      
      // Handle countdown timer
      if (countdownTimer) {
        if (response.nextPostTime) {
          const now = Date.now();
          const remainingMs = Math.max(0, response.nextPostTime - now);
          const remainingSeconds = Math.ceil(remainingMs / 1000);
          
          if (remainingSeconds > 0) {
            // Format time as MM:SS
            const minutes = Math.floor(remainingSeconds / 60);
            const seconds = remainingSeconds % 60;
            
            // Display countdown
            countdownTimer.textContent = minutes > 0 
              ? `${minutes}:${seconds.toString().padStart(2, '0')}`
              : `${seconds}s`;
            
            // Add animation class
            countdownTimer.classList.add('countdown-active');
          } else {
            countdownTimer.textContent = '';
            countdownTimer.classList.remove('countdown-active');
          }
        } else {
          countdownTimer.textContent = '';
          countdownTimer.classList.remove('countdown-active');
        }
      }
    } else {
      // Update posting flag
      isPosting = false;
      
      // Hide posting status
      const statusDiv = document.getElementById('posting-status');
      if (statusDiv) statusDiv.style.display = 'none';
      
      // Enable post now button
      const postNowBtn = document.getElementById('post-now-btn');
      if (postNowBtn) postNowBtn.disabled = false;
      
      // Reset countdown timer
      const countdownTimer = document.getElementById('countdown-timer');
      if (countdownTimer) {
        countdownTimer.textContent = '';
        countdownTimer.classList.remove('countdown-active');
      }
    }
  });
}

/**
 * Update posting UI
 */
function updatePostingUI(completed, total) {
  const statusDiv = document.getElementById('posting-status');
  const progressBar = document.getElementById('posting-progress');
  const progressText = document.getElementById('progress-text');
  
  if (isPosting) {
    statusDiv.style.display = 'block';
    
    // Calculate percentage
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    // Update progress bar
    if (progressBar) {
      progressBar.style.width = `${percentage}%`;
      progressBar.setAttribute('aria-valuenow', percentage);
    }
    
    // Update progress text
    if (progressText) {
      progressText.textContent = `${completed}/${total}`;
    }
  } else {
    statusDiv.style.display = 'none';
  }
}

/**
 * Handle image uploads
 */
function handleImageUpload(event) {
  const files = event.target.files;
  if (!files || files.length === 0) return;
  
  // Convert file list to array
  const newFiles = Array.from(files);
  
  // Read each file as data URL
  Promise.all(newFiles.map(file => readFileAsDataURL(file)))
    .then(dataURLs => {
      // Add new images to current array
      currentImages = [...currentImages, ...dataURLs];
      
      // Show image previews
      renderImagePreviews();
      
      // Clear upload field to allow uploading same images again
      event.target.value = '';
    });
}

/**
 * Read file as data URL
 */
function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Show image previews
 */
function renderImagePreviews() {
  const previewArea = document.getElementById('image-preview-area');
  const noImagesMessage = document.getElementById('no-images-message');
  
  // Show or hide no images message
  noImagesMessage.style.display = currentImages.length === 0 ? 'block' : 'none';
  
  // Remove all existing previews except no images message
  Array.from(previewArea.children).forEach(child => {
    if (!child.classList.contains('no-images-message')) {
      child.remove();
    }
  });
  
  // Add new image previews
  currentImages.forEach((dataURL, index) => {
    const template = document.getElementById('image-preview-template');
    const clone = document.importNode(template.content, true);
    
    // Set image source
    const img = clone.querySelector('.preview-img');
    img.src = dataURL;
    
    // Add image removal event
    const removeBtn = clone.querySelector('.remove-image-btn');
    removeBtn.addEventListener('click', () => removeImage(index));
    
    previewArea.appendChild(clone);
  });
}

/**
 * Remove image
 */
function removeImage(index) {
  currentImages.splice(index, 1);
  renderImagePreviews();
}

/**
 * Clear all images
 */
function clearImages() {
  currentImages = [];
  renderImagePreviews();
}

/**
 * Handle image uploads in edit dialog
 */
function handleEditImageUpload(event) {
  const files = event.target.files;
  if (!files || files.length === 0) return;
  
  // Convert file list to array
  const newFiles = Array.from(files);
  
  // Read each file as data URL
  Promise.all(newFiles.map(file => readFileAsDataURL(file)))
    .then(dataURLs => {
      // Add new images to current array
      const editImages = getEditImages();
      setEditImages([...editImages, ...dataURLs]);
      
      // Show image previews
      renderEditImagePreviews();
      
      // Clear upload field to allow uploading same images again
      event.target.value = '';
    });
}

/**
 * Get current images in edit dialog
 */
function getEditImages() {
  const previewArea = document.getElementById('edit-image-preview-area');
  const images = [];
  
  // Collect all img elements from preview area
  const imgElements = previewArea.querySelectorAll('.preview-img');
  imgElements.forEach(img => {
    if (img.src) {
      images.push(img.src);
    }
  });
  
  return images;
}

/**
 * Set images in edit dialog
 */
function setEditImages(images) {
  const previewArea = document.getElementById('edit-image-preview-area');
  const noImagesMessage = document.getElementById('edit-no-images-message');
  
  // Show or hide no images message
  noImagesMessage.style.display = images.length === 0 ? 'block' : 'none';
  
  // Remove all existing previews except no images message
  Array.from(previewArea.children).forEach(child => {
    if (!child.classList.contains('no-images-message')) {
      child.remove();
    }
  });
  
  // Add new image previews
  images.forEach((dataURL, index) => {
    const template = document.getElementById('image-preview-template');
    const clone = document.importNode(template.content, true);
    
    // Set image source
    const img = clone.querySelector('.preview-img');
    img.src = dataURL;
    
    // Add image removal event
    const removeBtn = clone.querySelector('.remove-image-btn');
    removeBtn.addEventListener('click', () => {
      // Remove image from preview and from post data
      imageWrapper.remove();
      post.content[index].images.splice(imgIndex, 1);
    });
    
    previewArea.appendChild(clone);
  });
}

/**
 * Show image previews in edit dialog
 */
function renderEditImagePreviews() {
  const images = getEditImages();
  setEditImages(images);
}

/**
 * Clear all images in edit dialog
 */
function clearEditImages() {
  setEditImages([]);
}

/**
 * Open edit post images dialog
 */
function openPostImagesModal(postId) {
  currentEditPostId = postId;
  
  // Find post by ID
  const post = posts.find(p => p.id === postId);
  
  // Load post images
  if (post && post.images) {
    setEditImages(post.images);
  } else {
    setEditImages([]);
  }
  
  // Show dialog
  document.getElementById('post-images-modal').style.display = 'flex';
}

/**
 * Close edit post images dialog
 */
function closePostImagesModal() {
  document.getElementById('post-images-modal').style.display = 'none';
  currentEditPostId = null;
}

/**
 * Save post images
 */
function savePostImages() {
  if (currentEditPostId) {
    // Find post and update images
    const postIndex = posts.findIndex(p => p.id === currentEditPostId);
    
    if (postIndex !== -1) {
      posts[postIndex].images = getEditImages();
      
      // Update post display
      renderPosts();
    }
  }
  
  // Close dialog
  closePostImagesModal();
}

/**
 * Add new post
 */
function addNewPost() {
  const postContent = document.getElementById('post-content').value.trim();
  
  if (!postContent) {
    alert('Please enter post content');
    return;
  }
  
  const post = {
    id: Date.now(),
    text: postContent,
    images: [...currentImages] // Add current images to post
  };
  
  // Add post to array
  posts.push(post);
  
  // Show posts
  renderPosts();
  
  // Clear text field
  document.getElementById('post-content').value = '';
  
  // Clear images
  clearImages();
}

/**
 * Show posts in user interface
 */
function renderPosts() {
  const container = document.getElementById('post-list');
  container.innerHTML = '';
  
  if (posts.length === 0) {
    container.innerHTML = '<div class="text-center text-muted">No posts. Add new posts.</div>';
    return;
  }
  
  // Add each post to list
  posts.forEach((post, index) => {
    const template = document.getElementById('post-item-template');
    const clone = document.importNode(template.content, true);
    
    // Set post content
    clone.querySelector('.post-number').textContent = index + 1;
    clone.querySelector('.post-item-content').textContent = post.text;
    
    // Show post images
    const imagesContainer = clone.querySelector('.post-item-images');
    
    if (post.images && post.images.length > 0) {
      post.images.forEach(imgSrc => {
        const imgDiv = document.createElement('div');
        imgDiv.className = 'post-item-image';
        const img = document.createElement('img');
        img.src = imgSrc;
        imgDiv.appendChild(img);
        imagesContainer.appendChild(imgDiv);
      });
    }
    
    // Add post ID
    const postItem = clone.querySelector('.post-item');
    postItem.dataset.postId = post.id;
    
    // Add post removal event
    const removeBtn = clone.querySelector('.remove-post-btn');
    removeBtn.addEventListener('click', () => removePost(post.id));
    
    // Add post edit event
    const editImagesBtn = clone.querySelector('.edit-post-images-btn');
    editImagesBtn.addEventListener('click', () => openPostImagesModal(post.id));
    
    container.appendChild(clone);
  });
}

/**
 * Remove post
 */
function removePost(postId) {
  posts = posts.filter(post => post.id !== postId);
  renderPosts();
}

/**
 * Show groups in user interface
 */
function renderGroups() {
  const container = document.getElementById('groups-container');
  if (!container) {
    console.error("No element found with id 'groups-container'");
    return;
  }
  
  container.innerHTML = '';
  
  const noGroupsElement = document.getElementById('no-groups');
  
  // Filter groups by collection if needed
  let filteredGroups = groups;
  if (currentCollection !== 'all') {
    filteredGroups = groups.filter(group => 
      group.collectionIds && group.collectionIds.includes(currentCollection)
    );
  }
  
  if (filteredGroups.length === 0) {
    if (noGroupsElement) {
      noGroupsElement.style.display = 'block';
      if (currentCollection !== 'all') {
        noGroupsElement.textContent = 'No groups in this collection.';
      } else {
        noGroupsElement.textContent = 'No groups found. Click "Refresh Groups" to start.';
      }
    }
    return;
  }
  
  if (noGroupsElement) {
    noGroupsElement.style.display = 'none';
  }
  
  // Add each group to list
  filteredGroups.forEach(group => {
    const template = document.getElementById('group-item-template');
    if (!template) {
      console.error("No template found with id 'group-item-template'");
      return;
    }
    
    const clone = document.importNode(template.content, true);
    
    // Set group name
    const groupNameElement = clone.querySelector('.group-name');
    if (groupNameElement) {
      groupNameElement.textContent = group.name;
      
      // Add collection badges if any
      if (group.collectionIds && group.collectionIds.length > 0) {
        const collectionNames = group.collectionIds.map(id => {
          const collection = collections.find(c => c.id === id);
          return collection ? collection.name : null;
        }).filter(name => name !== null);
        
        if (collectionNames.length > 0) {
          const badge = document.createElement('span');
          badge.className = 'badge bg-info ms-2';
          badge.textContent = collectionNames.join(', ');
          groupNameElement.appendChild(badge);
        }
      }
    }
    
    // Set group URL
    const item = clone.querySelector('.group-item');
    if (item) {
      item.dataset.url = group.url;
    }
    
    // Set checkbox state if group is selected
    const checkbox = clone.querySelector('.group-checkbox');
    if (checkbox) {
      checkbox.checked = selectedGroups.some(g => g.url === group.url);
      
      // Add change event listener
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          if (!selectedGroups.some(g => g.url === group.url)) {
            selectedGroups.push(group);
          }
        } else {
          selectedGroups = selectedGroups.filter(g => g.url !== group.url);
        }
        
        updateSelectedGroupsCount();
      });
    }
    
    container.appendChild(clone);
  });
  
  updateSelectedGroupsCount();
}

/**
 * Update selected groups count
 */
function updateSelectedGroupsCount() {
  const countElement = document.getElementById('groups-selected-count');
  const modalCountElement = document.getElementById('selected-groups-count');
  
  if (countElement) {
    countElement.textContent = `${selectedGroups.length} selected`;
  }
  
  if (modalCountElement) {
    modalCountElement.textContent = `${selectedGroups.length} selected groups`;
  }
}

/**
 * نافذة اختيار المجموعات
 * تفتح نافذة منبثقة تمكن المستخدم من اختيار المجموعات من القائمة
 * وتصفيتها حسب التصنيفات المختلفة
 */
function openGroupsModal() {
  // Reset modal collection filter to 'all'
  modalCurrentCollection = 'all';
  
  // Populate collections dropdown in modal
  const modalCollectionSelect = document.getElementById('modal-group-collection-select');
  if (modalCollectionSelect) {
    // Clear existing options except first one
    while (modalCollectionSelect.options.length > 1) {
      modalCollectionSelect.remove(1);
    }
    
    // Add collections
    collections.forEach(collection => {
      const option = document.createElement('option');
      option.value = collection.id;
      option.textContent = collection.name;
      modalCollectionSelect.appendChild(option);
    });
    
    // Set to 'all'
    modalCollectionSelect.value = 'all';
  }
  
  // Update groups in modal based on current filter
  renderModalGroups();
  
  // Show modal
  document.getElementById('groups-modal').style.display = 'flex';
}

/**
 * Render groups in the modal based on filter
 */
function renderModalGroups() {
  const modalContainer = document.getElementById('modal-groups-container');
  if (!modalContainer) return;
  
  modalContainer.innerHTML = '';
  
  // Filter groups by collection if needed
  let filteredGroups = groups;
  if (modalCurrentCollection !== 'all') {
    filteredGroups = groups.filter(group => 
      group.collectionIds && group.collectionIds.includes(modalCurrentCollection)
    );
  }
  
  // If no groups after filtering
  if (filteredGroups.length === 0) {
    modalContainer.innerHTML = '<div class="text-center p-3 text-muted">No groups in this collection</div>';
    return;
  }
  
  // Add each group to list
  filteredGroups.forEach(group => {
    const template = document.getElementById('group-item-template');
    if (!template) {
      console.error("No template found with id 'group-item-template'");
      return;
    }
    
    const clone = document.importNode(template.content, true);
    
    // Set group name
    const groupNameElement = clone.querySelector('.group-name');
    if (groupNameElement) {
      groupNameElement.textContent = group.name;
      
      // Add collection badges if any
      if (group.collectionIds && group.collectionIds.length > 0) {
        const collectionNames = group.collectionIds.map(id => {
          const collection = collections.find(c => c.id === id);
          return collection ? collection.name : null;
        }).filter(name => name !== null);
        
        if (collectionNames.length > 0) {
          const badge = document.createElement('span');
          badge.className = 'badge bg-info ms-2';
          badge.textContent = collectionNames.join(', ');
          groupNameElement.appendChild(badge);
        }
      }
    }
    
    // Set group URL
    const item = clone.querySelector('.group-item');
    if (item) {
      item.dataset.url = group.url;
    }
    
    // Set checkbox state if group is selected
    const checkbox = clone.querySelector('.group-checkbox');
    if (checkbox) {
      checkbox.checked = selectedGroups.some(g => g.url === group.url);
    }
    
    modalContainer.appendChild(clone);
  });
}

/**
 * Select all groups in modal
 */
function selectAllModalGroups() {
  const checkboxes = document.querySelectorAll('#modal-groups-container .group-checkbox');
  checkboxes.forEach(checkbox => {
    checkbox.checked = true;
  });
}

/**
 * Deselect all groups in modal
 */
function deselectAllModalGroups() {
  const checkboxes = document.querySelectorAll('#modal-groups-container .group-checkbox');
  checkboxes.forEach(checkbox => {
    checkbox.checked = false;
  });
}

/**
 * Close groups modal
 */
function closeGroupsModal() {
  document.getElementById('groups-modal').style.display = 'none';
}

/**
 * Confirm group selection from modal
 */
function confirmGroupSelection() {
  // Get selected groups from modal
  const checkboxes = document.querySelectorAll('#modal-groups-container .group-checkbox');
  selectedGroups = [];
  
  checkboxes.forEach(checkbox => {
    if (checkbox.checked) {
      const groupItem = checkbox.closest('.group-item');
      // Only process visible items (not filtered out)
      if (groupItem.style.display !== 'none') {
        const url = groupItem.dataset.url;
        const name = groupItem.querySelector('.group-name').textContent;
        
        // Extract the name without any badge text
        const cleanName = name.split(/\s+\(/)[0].trim();
        
        selectedGroups.push({ url, name: cleanName });
      }
    }
  });
  
  updateSelectedGroupsCount();
  closeGroupsModal();
}

/**
 * Select all groups
 */
function selectAllGroups() {
  const checkboxes = document.querySelectorAll('#groups-container .group-checkbox');
  checkboxes.forEach(checkbox => {
    checkbox.checked = true;
    const groupItem = checkbox.closest('.group-item');
    const url = groupItem.dataset.url;
    const name = groupItem.querySelector('.group-name').textContent;
    
    if (!selectedGroups.some(g => g.url === url)) {
      selectedGroups.push({ url, name });
    }
  });
  
  updateSelectedGroupsCount();
}

/**
 * Deselect all groups
 */
function deselectAllGroups() {
  const checkboxes = document.querySelectorAll('#groups-container .group-checkbox');
  checkboxes.forEach(checkbox => {
    checkbox.checked = false;
  });
  
  selectedGroups = [];
  updateSelectedGroupsCount();
}

/**
 * Refresh groups
 */
function refreshGroups() {
  // Show loading message
  document.getElementById('groups-container').innerHTML = '<div class="text-center p-2">Loading groups...</div>';
  
  // Open Facebook in new tab to get groups
  chrome.tabs.create({ url: 'https://www.facebook.com/groups/feed/', active: false }, tab => {
    // Listen for page load completion
    chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
      if (tabId === tab.id && changeInfo.status === 'complete') {
        // Remove listener
        chrome.tabs.onUpdated.removeListener(listener);
        
        // Wait for page to load completely
        setTimeout(() => {
          // Send message to extract groups
          chrome.tabs.sendMessage(tab.id, { action: 'extractGroups' }, response => {
            // Close tab
            chrome.tabs.remove(tab.id);
            
            if (response && response.success && response.groups.length > 0) {
              // Save groups to storage
              groups = response.groups;
              chrome.storage.local.set({ fbGroups: groups }, () => {
                console.log('Groups saved successfully');
                renderGroups();
              });
            } else {
              document.getElementById('groups-container').innerHTML = '<div class="text-center text-danger p-2">No groups found. Please try again later.</div>';
            }
          });
        }, 3000);
      }
    });
  });
}

/**
 * Save selected groups
 */
function saveSelectedGroups() {
  chrome.storage.local.set({ selectedGroups }, () => {
    alert('Selected groups saved successfully');
  });
}

/**
 * Filter groups by search term
 */
function filterGroups() {
  const searchTerm = document.getElementById('group-search').value.toLowerCase();
  const groupItems = document.querySelectorAll('#modal-groups-container .group-item');
  
  // Apply search filter to visible items (those not hidden by collection filter)
  groupItems.forEach(item => {
    // Skip items that are already hidden by collection filter
    if (item.style.display !== 'none' || item.style.display === '') {
      const groupName = item.querySelector('.group-name').textContent.toLowerCase();
      if (groupName.includes(searchTerm)) {
        item.style.display = 'flex';
      } else {
        item.style.display = 'none';
      }
    }
  });
}

/**
 * Post content to groups
 */
function postContent() {
  if (isPosting) {
    alert("A posting process is already in progress. Please wait or stop it before starting a new one.");
    return;
  }
  
  // Use the global selectedGroups variable directly
  if (selectedGroups.length === 0) {
    alert("Please select at least one group to post to.");
    return;
  }
  
  // Check if multiple posts are enabled
  const enableMultiplePosts = document.getElementById('enable-multiple-posts').checked;
  
  if (enableMultiplePosts && posts.length === 0) {
    alert("Please add at least one post before continuing.");
    return;
  }
  
  // In single post mode, validate content
  if (!enableMultiplePosts) {
    const postText = document.getElementById('post-content').value.trim();
    
    if (!postText && currentImages.length === 0) {
      alert("Please enter post content or add images before posting.");
      return;
    }
  }
  
  // Get posting interval settings
  const intervalMin = parseInt(document.getElementById('post-interval-min').value) || 30;
  const intervalMax = parseInt(document.getElementById('post-interval-max').value) || 60;
  
  // Validate intervals
  if (intervalMin < 10 || intervalMax < intervalMin) {
    alert("Please check your posting interval settings. Minimum posting interval should be at least 10 seconds, and maximum should be greater than or equal to minimum.");
    return;
  }
  
  // Get pause settings
  const enablePause = document.getElementById('enable-pause').checked;
  const postsBeforePause = enablePause ? (parseInt(document.getElementById('posts-before-pause').value) || 5) : 0;
  const pauseDuration = enablePause ? (parseInt(document.getElementById('pause-duration').value) || 15) : 0;
  
  // Prepare posting data
  const postingData = {
    action: 'startPosting',
    enableMultiplePosts,
    randomSelection: enableMultiplePosts ? document.getElementById('random-selection').checked : false,
    posts: enableMultiplePosts ? posts : [{ 
      text: document.getElementById('post-content').value.trim(), 
      images: currentImages 
    }],
    groups: selectedGroups,
    intervalSettings: {
      min: intervalMin,
      max: intervalMax,
      random: document.getElementById('random-interval').checked
    },
    pauseSettings: {
      enable: enablePause,
      postsBeforePause,
      pauseDuration
    }
  };
  
  // Update UI before posting
  const statusDiv = document.getElementById('posting-status');
  const statusMessage = document.getElementById('status-message');
  const progressText = document.getElementById('progress-text');
  const progressBar = document.getElementById('posting-progress');
  const stopBtn = document.getElementById('stop-posting-btn');
  const countdownTimer = document.getElementById('countdown-timer');
  
  if (statusDiv) statusDiv.style.display = 'block';
  if (statusMessage) statusMessage.textContent = 'Starting posting process...';
  if (progressText) progressText.textContent = `0/${selectedGroups.length}`;
  if (progressBar) progressBar.style.width = '0%';
  if (stopBtn) stopBtn.style.display = 'block';
  if (countdownTimer) countdownTimer.textContent = '';
  
  // Disable post now button
  const postNowBtn = document.getElementById('post-now-btn');
  if (postNowBtn) postNowBtn.disabled = true;
  
  // Set posting flag
      isPosting = true;
  
  // Send message to background script to start posting
  chrome.runtime.sendMessage(postingData, response => {
    if (response && response.success) {
      console.log('Posting process started successfully');
      
      // Start checking status frequently to update countdown
      if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
      }
      
      // Check every second to ensure smooth countdown
      statusCheckInterval = setInterval(checkPostingStatus, 1000);
    } else {
      console.error('Failed to start posting process', response);
      if (statusMessage) statusMessage.textContent = 'Failed to start posting process. Please try again.';
      if (postNowBtn) postNowBtn.disabled = false;
      if (stopBtn) stopBtn.style.display = 'none';
      isPosting = false;
    }
  });
}

/**
 * Stop posting
 */
function stopPosting() {
  if (!isPosting) {
    return;
  }
  
  chrome.runtime.sendMessage({ action: "stopPosting" }, response => {
    if (response && response.success) {
      console.log("Posting process stopped!");
      document.getElementById('status-message').textContent = "Posting process stopped.";
      
      // Re-enable post button
      const postNowBtn = document.getElementById('post-now-btn');
      if (postNowBtn) {
        postNowBtn.disabled = false;
      }
      
      // Show stop button
      const stopPostingBtn = document.getElementById('stop-posting-btn');
      if (stopPostingBtn) {
        stopPostingBtn.style.display = 'none';
      }
      
      // Clear status check interval
      if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
        statusCheckInterval = null;
      }
      
      isPosting = false;
    } else {
      alert(response ? response.message : "Failed to stop posting process.");
    }
  });
}

/**
 * Schedule post
 */
function schedulePost() {
  // Use the global selectedGroups variable directly
  if (selectedGroups.length === 0) {
    alert("Please select at least one group to post to.");
    return;
  }
  
  // Get post content
  const postContent = document.getElementById('post-content').value.trim();
  const useMultiplePosts = document.getElementById('enable-multiple-posts').checked;
  
  // Process normal or multiple posts
  let content;
  if (useMultiplePosts) {
    if (posts.length === 0) {
      alert("Please add at least one post before continuing.");
      return;
    }
    // Keep the posts array as is, including all posts with their images
    content = JSON.parse(JSON.stringify(posts)); // Deep clone to avoid modifying original
  } else {
    if (!postContent && currentImages.length === 0) {
      alert("Please enter post content or add images.");
      return;
    }
    // Include both text and images
    content = { 
      text: postContent, 
      images: [...currentImages] // Make a copy of the images
    };
  }

  // Get schedule time
  const scheduleDateTime = document.getElementById('schedule-time').value;
  if (!scheduleDateTime) {
    alert("Please select a date and time for scheduling.");
    return;
  }
  
  const scheduleTime = new Date(scheduleDateTime).getTime();
  const now = Date.now();
  
  // Improved validation for schedule time
  if (isNaN(scheduleTime)) {
    alert("Invalid date format. Please select a valid date and time.");
    return;
  }
  
  if (scheduleTime <= now) {
    alert("The selected date and time is in the past. Please select a future date and time.");
    return;
  }
  
  // Get posting settings
  const intervalMin = parseInt(document.getElementById('post-interval-min').value) || 30;
  const intervalMax = parseInt(document.getElementById('post-interval-max').value) || 60;
  const enablePause = document.getElementById('enable-pause').checked;
  const postsBeforePause = parseInt(document.getElementById('posts-before-pause').value) || 5;
  const pauseDuration = parseInt(document.getElementById('pause-duration').value) || 15;

  // Validate intervals
  if (intervalMin < 10 || intervalMax < intervalMin) {
    alert("Please check your posting interval settings. Minimum posting interval should be at least 10 seconds, and maximum should be greater than or equal to minimum.");
    return;
  }

  // Check if recurring
  const recurring = document.getElementById('enable-recurring').checked;
  let recurringOptions = null;
  
  if (recurring) {
    const recurringType = document.querySelector('input[name="recurring-type"]:checked').value;
    const recurringCount = parseInt(document.getElementById('recurring-count').value) || 1;
    
    if (recurringCount < 1 || recurringCount > 50) {
      alert("Recurring count must be between 1 and 50.");
      return;
    }
    
    recurringOptions = {
      type: recurringType,
      count: recurringCount,
      currentCount: 0
    };
  }

  // Construct the message to background script
  const message = {
    action: "schedulePost",
    content: content,
    groups: selectedGroups,
    scheduleTime: scheduleTime,
    isRandom: document.getElementById('random-selection').checked,
    postingSettings: {
      intervalMin,
      intervalMax,
      random: document.getElementById('random-interval').checked,
      enablePause,
      postsBeforePause,
      pauseDuration
    },
    recurring: recurringOptions
  };
  
  // Show status message
  const statusMessage = document.getElementById('schedule-status');
  if (statusMessage) {
    statusMessage.textContent = "Scheduling post...";
    statusMessage.style.display = "block";
    statusMessage.className = "alert alert-info";
  }
  
  // Send message to background script
  chrome.runtime.sendMessage(message, response => {
    if (response && response.success) {
      // Show success message
      if (statusMessage) {
        statusMessage.textContent = "Post scheduled successfully!";
        statusMessage.className = "alert alert-success";
        
        // Hide message after 3 seconds
        setTimeout(() => {
          statusMessage.style.display = "none";
        }, 3000);
      } else {
        alert("Post scheduled successfully!");
      }
      
      // Clear form if specified
      if (document.getElementById('clear-after-schedule').checked) {
        document.getElementById('post-content').value = '';
        clearImages();
        
        document.querySelectorAll('#groups-container .group-checkbox').forEach(checkbox => {
          checkbox.checked = false;
        });
        
        selectedGroups = [];
        updateSelectedGroupsCount();
      }
      
      // Refresh scheduled posts list
      loadScheduledPosts();
    } else {
      // Show error message
      if (statusMessage) {
        statusMessage.textContent = response ? response.message : "Failed to schedule post.";
        statusMessage.className = "alert alert-danger";
      } else {
        alert(response ? response.message : "Failed to schedule post.");
      }
    }
  });
}

/**
 * Show scheduled posts
 */
function renderScheduledPosts(scheduledPosts) {
  const container = document.getElementById('scheduled-posts-container');
  
  if (!container) {
    console.error("Scheduled posts container not found!");
    return;
  }
  
  // Remove existing posts
  const noPostsElem = document.getElementById('no-scheduled-posts');
  container.innerHTML = '';
  
  if (noPostsElem) {
    container.appendChild(noPostsElem);
  }
  
  if (!scheduledPosts || scheduledPosts.length === 0) {
    if (noPostsElem) {
      noPostsElem.style.display = 'block';
    }
    return;
  }
  
  if (noPostsElem) {
    noPostsElem.style.display = 'none';
  }
  
  // Add scheduled posts
  scheduledPosts.forEach(post => {
    const template = document.getElementById('scheduled-post-template');
    if (!template) {
      console.error("Scheduled post template not found!");
      return;
    }
    
    const clone = document.importNode(template.content, true);
    
    // Create post element
    const postElem = clone.querySelector('.scheduled-post');
    postElem.dataset.postId = post.id;
    postElem.dataset.status = post.status;
    postElem.dataset.isEditMode = 'false';
    postElem.dataset.scheduleTime = post.scheduleTime;
    
    // Show section for displaying information (regular view)
    const viewSection = document.createElement('div');
    viewSection.className = 'view-section';
    
    // Set post status
    const statusElem = document.createElement('span');
    statusElem.className = `fw-bold me-2 scheduled-post-status status-${post.status}`;
    statusElem.textContent = getStatusText(post.status);
    viewSection.appendChild(statusElem);
    
    // Set scheduled time
    const timeElem = document.createElement('small');
    timeElem.className = 'text-muted scheduled-post-time';
    const scheduleDate = new Date(post.scheduleTime);
    timeElem.textContent = scheduleDate.toLocaleString();
    viewSection.appendChild(timeElem);
    
    // Add countdown timer if post is pending
    if (post.status === 'pending') {
      const countdownContainer = document.createElement('div');
      countdownContainer.className = 'countdown-container mt-1';
      
      const countdownLabel = document.createElement('small');
      countdownLabel.className = 'countdown-label me-2';
      countdownLabel.textContent = 'Time remaining:';
      
      const countdownValue = document.createElement('span');
      countdownValue.className = 'countdown-value badge bg-info';
      countdownValue.setAttribute('data-schedule-time', post.scheduleTime);
      
      // Calculate initial countdown value
      const now = Date.now(); // Define now variable
      const timeLeft = post.scheduleTime - now;
      
      if (timeLeft > 0) {
        countdownValue.textContent = formatCountdown(timeLeft);
      } else {
        countdownValue.textContent = 'Due now';
      }
      
      countdownContainer.appendChild(countdownLabel);
      countdownContainer.appendChild(countdownValue);
      viewSection.appendChild(countdownContainer);
    }
    
    // Set post count and group count
    const infoDiv = document.createElement('div');
    infoDiv.className = 'mt-1';
    
    const postCountBadge = document.createElement('span');
    postCountBadge.className = 'badge bg-secondary me-1 post-count';
    postCountBadge.textContent = Array.isArray(post.content) 
      ? `${post.content.length} post` 
      : '1 post';
    infoDiv.appendChild(postCountBadge);
    
    const groupCountBadge = document.createElement('span');
    groupCountBadge.className = 'badge bg-primary me-1 group-count';
    groupCountBadge.textContent = `${post.groups.length} groups`;
    infoDiv.appendChild(groupCountBadge);
    
    // Set recurring information
    const recurringBadge = document.createElement('span');
    recurringBadge.className = 'badge bg-info recurring-info';
    if (post.recurring) {
      const typeText = post.recurring.type === 'daily' ? 'daily' :
                      post.recurring.type === 'weekly' ? 'weekly' : 'monthly';
      recurringBadge.textContent = `Recurring ${typeText} (${post.recurring.currentCount}/${post.recurring.count})`;
      recurringBadge.style.display = 'inline-block';
    } else {
      recurringBadge.style.display = 'none';
    }
    infoDiv.appendChild(recurringBadge);
    
    viewSection.appendChild(infoDiv);
    
    // Post content if available
    if (!Array.isArray(post.content) || post.content.length === 1) {
      const contentText = document.createElement('div');
      contentText.className = 'post-content mt-1 text-muted small';
      contentText.style.overflow = 'hidden';
      contentText.style.textOverflow = 'ellipsis';
      contentText.style.whiteSpace = 'nowrap';
      contentText.style.maxWidth = '100%';
      
      const postText = getPostContentText(post.content);
      contentText.textContent = postText.length > 50 ? postText.substring(0, 50) + '...' : postText;
      viewSection.appendChild(contentText);
    }
    
    // Post actions section
    const buttonsDiv = document.createElement('div');
    buttonsDiv.className = 'd-flex justify-content-between align-items-center mt-2';
    
    // Action buttons
    const actionButtons = document.createElement('div');
    
    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-sm btn-outline-primary edit-post-btn';
    editBtn.innerHTML = '<i class="fas fa-edit"></i> Edit';
    editBtn.title = 'Edit post';
    editBtn.addEventListener('click', () => toggleEditMode(post, postElem));
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn btn-sm btn-outline-danger remove-post-btn ms-2';
    removeBtn.innerHTML = '<i class="fas fa-trash"></i> Remove';
    removeBtn.title = 'Remove post';
    removeBtn.addEventListener('click', () => deleteScheduledPost(post.id));
    
    actionButtons.appendChild(editBtn);
    actionButtons.appendChild(removeBtn);
    
    buttonsDiv.appendChild(actionButtons);
    viewSection.appendChild(buttonsDiv);
    
    // Add view section to post
    postElem.appendChild(viewSection);
    
    // Create edit section (initially hidden)
    const editSection = document.createElement('div');
    editSection.className = 'edit-section';
    editSection.style.display = 'none';
    
    // Add edit form elements
    createEditSectionElements(editSection, post);
    
    // Add edit section to post
    postElem.appendChild(editSection);
    
    container.appendChild(clone);
  });
  
  // Start countdown timer updating
  startCountdownTimers();
}

/**
 * Format countdown time in a human-readable format
 */
function formatCountdown(milliseconds) {
  if (milliseconds <= 0) {
    return 'Due now';
  }
  
  const seconds = Math.floor(milliseconds / 1000) % 60;
  const minutes = Math.floor(milliseconds / (1000 * 60)) % 60;
  const hours = Math.floor(milliseconds / (1000 * 60 * 60)) % 24;
  const days = Math.floor(milliseconds / (1000 * 60 * 60 * 24));
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Start updating countdown timers
 */
function startCountdownTimers() {
  // Clear any existing timer
  if (window.countdownInterval) {
    clearInterval(window.countdownInterval);
  }
  
  // Update countdown values every second
  window.countdownInterval = setInterval(() => {
    const countdowns = document.querySelectorAll('.countdown-value');
    const now = Date.now();
    
    countdowns.forEach(countdown => {
      const scheduleTime = parseInt(countdown.getAttribute('data-schedule-time'));
      const timeLeft = scheduleTime - now;
      
      if (timeLeft > 0) {
        countdown.textContent = formatCountdown(timeLeft);
      } else {
        countdown.textContent = 'Due now';
      }
    });
  }, 1000);
}

/**
 * Toggle edit mode for scheduled post
 */
function toggleEditMode(post, postElem) {
  const isEditMode = postElem.dataset.isEditMode === 'true';
  const viewSection = postElem.querySelector('.view-section');
  const editSection = postElem.querySelector('.edit-section');
  
  if (isEditMode) {
    // Return to view mode
    viewSection.style.display = 'block';
    editSection.style.display = 'none';
    postElem.dataset.isEditMode = 'false';
  } else {
    // Switch to edit mode
    viewSection.style.display = 'none';
    editSection.style.display = 'block';
    postElem.dataset.isEditMode = 'true';
  }
}

/**
 * Save edit changes for scheduled post
 */
function saveEditChanges(postId, postElem) {
  // First check if we're dealing with multiple posts or a single post
  const isMultiplePosts = postElem.querySelectorAll('.post-edit-item').length > 0;
  
  let newContent;
  
  if (isMultiplePosts) {
    // Handle multiple posts
    newContent = [];
    const postEditItems = postElem.querySelectorAll('.post-edit-item');
    
    postEditItems.forEach((item, index) => {
      const contentInput = document.getElementById(`edit-content-${postId}-${index}`);
      if (!contentInput) {
        console.error(`Content input for post ${index} not found`);
        return;
      }
      
      // Get post text
      const postText = contentInput.value.trim();
      
      // Create a post object with the updated text
      // Images are already updated directly in the post object when removed or added
      const postData = {
        text: postText,
        images: [] // Will be filled from the existing post data
      };
      
      // Add the post to the content array
      newContent.push(postData);
    });
    
    // Now get the original post to copy images data
    chrome.runtime.sendMessage({ action: "getScheduledPost", postId }, response => {
      if (response && response.success && response.post) {
        const originalPost = response.post;
        
        // Copy images from original post if they exist
        if (Array.isArray(originalPost.content)) {
          for (let i = 0; i < Math.min(newContent.length, originalPost.content.length); i++) {
            if (originalPost.content[i].images) {
              newContent[i].images = originalPost.content[i].images;
            }
          }
        }
        
        // Continue with saving the post
        finalizeSaveChanges(postId, postElem, newContent);
      } else {
        // If we can't get the original post, just use empty images arrays
        finalizeSaveChanges(postId, postElem, newContent);
      }
    });
  } else {
    // Handle single post
    const contentInput = document.getElementById(`edit-content-${postId}`);
    if (!contentInput) {
      alert('Error finding content input');
      return;
    }
    
    const postText = contentInput.value.trim();
    if (!postText) {
      alert('Please enter post content');
      return;
    }
    
    // Get the original post to copy images data
    chrome.runtime.sendMessage({ action: "getScheduledPost", postId }, response => {
      if (response && response.success && response.post) {
        const originalPost = response.post;
        
        // Create new content object
        if (Array.isArray(originalPost.content)) {
          // If original was an array, keep it as an array with updated text
          newContent = originalPost.content.map((post, index) => {
            if (index === 0) {
              return {
                text: postText,
                images: post.images || []
              };
            }
            return post; // Keep other posts unchanged
          });
        } else {
          // Single post case
          newContent = {
            text: postText,
            images: originalPost.content.images || []
          };
        }
        
        // Continue with saving the post
        finalizeSaveChanges(postId, postElem, newContent);
      } else {
        // If we can't get the original post, create a new one without images
        newContent = { text: postText, images: [] };
        finalizeSaveChanges(postId, postElem, newContent);
      }
    });
  }
}

/**
 * Finalize the save changes process after handling content and images
 */
function finalizeSaveChanges(postId, postElem, newContent) {
  // Get time input
  const timeInput = document.getElementById(`edit-time-${postId}`);
  if (!timeInput) {
    alert('Error finding time input');
    return;
  }
  
  const newScheduleTime = timeInput.value;
  if (!newScheduleTime) {
    alert('Please select time for scheduling');
    return;
  }
  
  const newScheduledDateTime = new Date(newScheduleTime);
  
  // Check if the new schedule time is in the past
  if (newScheduledDateTime.getTime() <= Date.now()) {
    alert('The selected date and time is in the past. Please select a future date and time.');
    return;
  }
  
  // New recurring information
  const recurringCheck = document.getElementById(`edit-recurring-${postId}`);
  if (!recurringCheck) {
    alert('Error finding recurring checkbox');
    return;
  }
  
  const isRecurring = recurringCheck.checked;
  let recurring = null;
  
  if (isRecurring) {
    // Use document.querySelector instead of trying to query from postElem
    const recurringType = document.querySelector(`input[name="edit-recurring-type-${postId}"]:checked`);
    if (!recurringType) {
      alert('Please select a recurring type');
      return;
    }
    
    const recurringCountInput = document.getElementById(`edit-recurring-count-${postId}`);
    if (!recurringCountInput) {
      alert('Error finding recurring count input');
      return;
    }
    
    const recurringCount = parseInt(recurringCountInput.value) || 0;
    
    if (recurringCount <= 0) {
      alert('Please enter a valid recurring count');
      return;
    }
    
    recurring = {
      type: recurringType.value,
      count: recurringCount,
      currentCount: 0 // Reset counter on edit
    };
  }
  
  // Send edit request
  chrome.runtime.sendMessage({
    action: 'updateScheduledPost',
    postId: postId,
    updatedPost: {
      content: newContent,
      scheduleTime: newScheduledDateTime.getTime(),
      recurring: recurring
    }
  }, response => {
    if (response.success) {
      // Reload scheduled posts
      loadScheduledPosts();
      alert('Post updated successfully!');
    } else {
      alert(`Failed to update post: ${response.message}`);
    }
  });
}

/**
 * Get post status text
 */
function getStatusText(status) {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'processing':
      return 'Posting';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    default:
      return status;
  }
}

/**
 * Delete scheduled post
 */
function deleteScheduledPost(postId) {
  if (confirm('Are you sure you want to delete this scheduled post?')) {
    chrome.runtime.sendMessage({ action: 'deleteScheduledPost', postId }, response => {
      if (response.success) {
        loadScheduledPosts();
      } else {
        alert(`Failed to delete scheduled post: ${response.message}`);
      }
    });
  }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'postingComplete') {
    isPosting = false;
    updatePostingUI(message.postsCompleted, message.postsCompleted);
    alert(`Posting completed! ${message.postsCompleted} posts posted successfully.`);
  } else if (message.action === 'postingProgress') {
    updatePostingUI(message.completed, message.total);
  } else if (message.action === 'postingError') {
    // عرض رسالة عن المجموعة التي فشل النشر فيها
    displayPostingError(message.group, message.failedGroups);
  }
});

/**
 * عرض خطأ النشر في المجموعات
 */
function displayPostingError(group, failedGroups) {
  console.log(`Posting failed for group: ${group.name}`);
  
  // تحديث واجهة المستخدم لعرض الخطأ
  const statusElement = document.getElementById('posting-status');
  if (statusElement) {
    // إضافة تنبيه جديد للمجموعة التي فشل النشر فيها
    const alertElement = document.createElement('div');
    alertElement.className = 'alert alert-warning mb-2';
    alertElement.innerHTML = `فشل النشر في مجموعة: ${group.name}`;
    statusElement.appendChild(alertElement);
    
    // عرض قسم المجموعات التي فشل النشر فيها
    statusElement.style.display = 'block';
  }
  
  // إنشاء قسم للمجموعات التي فشل النشر فيها إذا لم يكن موجودًا
  let failedGroupsSection = document.getElementById('failed-groups-section');
  if (!failedGroupsSection) {
    failedGroupsSection = document.createElement('div');
    failedGroupsSection.id = 'failed-groups-section';
    failedGroupsSection.className = 'mt-3 p-3 border rounded bg-light';
    
    const postingControlsSection = document.getElementById('posting-controls');
    if (postingControlsSection) {
      postingControlsSection.parentNode.insertBefore(failedGroupsSection, postingControlsSection.nextSibling);
    } else {
      const mainContent = document.querySelector('.tab-content');
      if (mainContent) {
        mainContent.appendChild(failedGroupsSection);
      }
    }
  }
  
  // تحديث قائمة المجموعات التي فشل النشر فيها
  failedGroupsSection.innerHTML = `
    <h5 class="text-danger">المجموعات التي فشل النشر فيها (${failedGroups.length})</h5>
    <ul class="list-group">
      ${failedGroups.map(g => `
        <li class="list-group-item d-flex justify-content-between align-items-center">
          ${g.name}
          <div>
            <a href="${g.url}" target="_blank" class="btn btn-sm btn-outline-primary">فتح المجموعة</a>
            <button class="btn btn-sm btn-outline-success retry-group-btn" data-group-url="${g.url}">إعادة المحاولة</button>
          </div>
        </li>
      `).join('')}
    </ul>
    <div class="mt-2">
      <p class="small text-muted">يمكنك محاولة النشر مرة أخرى في هذه المجموعات فقط عن طريق تحديدها وإعادة النشر.</p>
      <button id="retry-all-failed-groups" class="btn btn-sm btn-success">إعادة المحاولة لجميع المجموعات</button>
    </div>
  `;
  
  // إضافة مستمعي الأحداث لأزرار إعادة المحاولة
  const retryButtons = failedGroupsSection.querySelectorAll('.retry-group-btn');
  retryButtons.forEach(button => {
    button.addEventListener('click', function() {
      const groupUrl = this.getAttribute('data-group-url');
      retryPostingToGroup(groupUrl);
    });
  });
  
  // إضافة مستمع حدث لزر إعادة المحاولة لجميع المجموعات
  const retryAllButton = failedGroupsSection.querySelector('#retry-all-failed-groups');
  if (retryAllButton) {
    retryAllButton.addEventListener('click', function() {
      retryPostingToAllFailedGroups(failedGroups);
    });
  }
}

/**
 * إعادة محاولة النشر في مجموعة محددة
 */
function retryPostingToGroup(groupUrl) {
  // البحث عن المجموعة في قائمة المجموعات
  const group = findGroupByUrl(groupUrl);
  if (!group) {
    alert('لم يتم العثور على المجموعة في قائمة المجموعات المتاحة');
    return;
  }
  
  // تحديد المجموعة فقط
  const groupCheckboxes = document.querySelectorAll('.group-checkbox');
  groupCheckboxes.forEach(checkbox => {
    checkbox.checked = checkbox.closest('.group-item').querySelector('.group-name').textContent === group.name;
  });
  
  // الانتقال إلى علامة التبويب الرئيسية
  document.querySelector('.nav-tabs .nav-tab[data-tab="main"]').click();
  
  // عرض رسالة للمستخدم
  alert(`تم تحديد المجموعة "${group.name}" للنشر. يمكنك الآن النقر على زر "نشر الآن" لإعادة المحاولة.`);
}

/**
 * إعادة محاولة النشر في جميع المجموعات التي فشل النشر فيها
 */
function retryPostingToAllFailedGroups(failedGroups) {
  // تحديد جميع المجموعات التي فشل النشر فيها
  const groupCheckboxes = document.querySelectorAll('.group-checkbox');
  groupCheckboxes.forEach(checkbox => {
    const groupName = checkbox.closest('.group-item').querySelector('.group-name').textContent;
    const groupExists = failedGroups.some(g => g.name === groupName);
    checkbox.checked = groupExists;
  });
  
  // الانتقال إلى علامة التبويب الرئيسية
  document.querySelector('.nav-tabs .nav-tab[data-tab="main"]').click();
  
  // عرض رسالة للمستخدم
  alert(`تم تحديد ${failedGroups.length} مجموعة للنشر. يمكنك الآن النقر على زر "نشر الآن" لإعادة المحاولة.`);
}

/**
 * البحث عن مجموعة بواسطة عنوان URL
 */
function findGroupByUrl(url) {
  // البحث في قائمة المجموعات المحفوظة
  const savedGroups = JSON.parse(localStorage.getItem('savedGroups') || '[]');
  return savedGroups.find(g => g.url === url);
}

/**
 * Add styles to buttons
 */
function addButtonStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .scheduled-post .edit-post-btn, .scheduled-post .remove-post-btn {
      margin: 0 2px;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .scheduled-post .edit-post-btn:hover {
      background-color: #0d6efd;
      color: white;
    }
    
    .scheduled-post .remove-post-btn:hover {
      background-color: #dc3545;
      color: white;
    }
    
    .status-pending {
      color: #ffc107;
    }
    
    .status-processing {
      color: #0dcaf0;
    }
    
    .status-completed {
      color: #198754;
    }
    
    .status-failed {
      color: #dc3545;
    }
    
    .countdown-container {
      display: flex;
      align-items: center;
      margin-top: 5px;
      font-size: 0.9rem;
    }
    
    .countdown-value {
      font-family: monospace;
      padding: 2px 6px;
      border-radius: 3px;
      background-color: #0dcaf0;
      color: white;
      display: inline-block;
      min-width: 75px;
      text-align: center;
    }
    
    .countdown-label {
      color: #6c757d;
      margin-right: 5px;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Open add group modal
 */
function openAddGroupModal() {
  document.getElementById('add-group-modal').style.display = 'flex';
  
  // Clear form
  document.getElementById('group-name').value = '';
  document.getElementById('group-url').value = '';
  document.getElementById('bulk-groups').value = '';
  document.getElementById('file-name').textContent = '';
  
  // Reset to first tab
  const modalTabButtons = document.querySelectorAll('.modal-body .nav-tab');
  modalTabButtons.forEach((btn, index) => {
    if (index === 0) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  const tabContents = document.querySelectorAll('.modal-tab-content');
  tabContents.forEach((content, index) => {
    if (index === 0) {
      content.style.display = 'block';
    } else {
      content.style.display = 'none';
    }
  });
}

/**
 * Close add group modal
 */
function closeAddGroupModal() {
  document.getElementById('add-group-modal').style.display = 'none';
}

/**
 * Add group manually
 */
function addGroupManually() {
  // Determine which tab is active
  const activeTab = document.querySelector('.modal-body .nav-tab.active').getAttribute('data-modal-tab');
  
  if (activeTab === 'single-group') {
    // Single group mode
    const name = document.getElementById('group-name').value.trim();
    const url = document.getElementById('group-url').value.trim();
    const collectionId = document.getElementById('group-collection').value;
    
    if (!name) {
      alert('Please enter a group name');
      return;
    }
    
    if (!url) {
      alert('Please enter a group URL');
      return;
    }
    
    // Validate URL
    if (!url.includes('facebook.com/groups/')) {
      alert('Please enter a valid Facebook group URL');
      return;
    }
    
    // Add group
    addGroup(name, url, collectionId);
    
    // Close modal
    closeAddGroupModal();
  } else {
    // Bulk import mode
    const bulkText = document.getElementById('bulk-groups').value.trim();
    const collectionId = document.getElementById('bulk-collection').value;
    const format = document.getElementById('bulk-format').value;
    
    if (!bulkText) {
      alert('Please enter group URLs');
      return;
    }
    
    // Process bulk text
    processBulkGroups(bulkText, format, collectionId);
    
    // Close modal
    closeAddGroupModal();
  }
}

/**
 * Process bulk group text
 */
function processBulkGroups(text, format, collectionId) {
  const lines = text.split('\n').filter(line => line.trim() !== '');
  
  if (lines.length === 0) {
    alert('No valid group URLs found');
    return;
  }
  
  let newGroups = [];
  
  if (format === 'url-only') {
    // URLs only format
    newGroups = lines.map(url => {
      url = url.trim();
      const id = url.split('/').pop().split('?')[0]; // Extract ID from URL
      return {
        name: `Group ${id}`, // Default name
        url: url
      };
    });
  } else {
    // Name,URL format
    newGroups = lines.map(line => {
      const parts = line.split(',');
      if (parts.length < 2) {
        return null;
      }
      
      const name = parts[0].trim();
      const url = parts[1].trim();
      
      if (!name || !url) {
        return null;
      }
      
      return {
        name: name,
        url: url
      };
    }).filter(group => group !== null);
  }
  
  if (newGroups.length === 0) {
    alert('No valid group entries found');
    return;
  }
  
  // Add groups to storage
  addBulkGroups(newGroups, collectionId);
}

/**
 * Handle file import
 */
function handleFileImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  // Display file name
  document.getElementById('file-name').textContent = file.name;
  
  // Read file
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('bulk-groups').value = e.target.result;
  };
  reader.readAsText(file);
}

/**
 * Add a single group
 */
function addGroup(name, url, collectionId) {
  // Check if group already exists
  const existingIndex = groups.findIndex(g => g.url === url);
  
  if (existingIndex >= 0) {
    // Update existing group
    groups[existingIndex].name = name;
    
    // Update collection if provided
    if (collectionId) {
      if (!groups[existingIndex].collectionIds) {
        groups[existingIndex].collectionIds = [];
      }
      
      if (!groups[existingIndex].collectionIds.includes(collectionId)) {
        groups[existingIndex].collectionIds.push(collectionId);
      }
    }
  } else {
    // Add new group
    const newGroup = {
      name: name,
      url: url,
      collectionIds: collectionId ? [collectionId] : []
    };
    
    groups.push(newGroup);
  }
  
  // Save groups
  saveGroups();
  
  // Update UI
  renderGroups();
}

/**
 * Add multiple groups
 */
function addBulkGroups(newGroups, collectionId) {
  // Process each group
  newGroups.forEach(newGroup => {
    // Check if group already exists
    const existingIndex = groups.findIndex(g => g.url === newGroup.url);
    
    if (existingIndex >= 0) {
      // Update existing group
      if (newGroup.name && newGroup.name !== `Group ${newGroup.url.split('/').pop().split('?')[0]}`) {
        groups[existingIndex].name = newGroup.name;
      }
      
      // Update collection if provided
      if (collectionId) {
        if (!groups[existingIndex].collectionIds) {
          groups[existingIndex].collectionIds = [];
        }
        
        if (!groups[existingIndex].collectionIds.includes(collectionId)) {
          groups[existingIndex].collectionIds.push(collectionId);
        }
      }
    } else {
      // Add new group
      const group = {
        name: newGroup.name,
        url: newGroup.url,
        collectionIds: collectionId ? [collectionId] : []
      };
      
      groups.push(group);
    }
  });
  
  // Save groups
  saveGroups();
  
  // Update UI
  renderGroups();
  
  // Show success message
  alert(`${newGroups.length} groups imported successfully`);
}

/**
 * Save groups to storage
 */
function saveGroups() {
  chrome.storage.local.set({ fbGroups: groups }, () => {
    console.log('Groups saved successfully');
  });
}

/**
 * Open collections modal
 */
function openCollectionsModal() {
  document.getElementById('collections-modal').style.display = 'flex';
  
  // Render collections
  renderCollections();
}

/**
 * Close collections modal
 */
function closeCollectionsModal() {
  document.getElementById('collections-modal').style.display = 'none';
}

/**
 * Add new collection
 */
function addNewCollection() {
  const name = document.getElementById('new-collection-name').value.trim();
  if (!name) {
    alert('Please enter a collection name');
    return;
  }
  
  // Create collection with unique ID
  const collection = {
    id: 'coll_' + Date.now(),
    name: name,
    count: 0
  };
  
  // Add to collections
  collections.push(collection);
  
  // Save collections
  saveCollections();
  
  // Clear input
  document.getElementById('new-collection-name').value = '';
  
  // Update UI
  renderCollections();
  populateCollectionDropdowns();
}

/**
 * Render collections in the collections modal
 */
function renderCollections() {
  const container = document.getElementById('collections-container');
  if (!container) {
    console.error('Collections container not found');
    return;
  }
  
  container.innerHTML = '';
  
  if (collections.length === 0) {
    container.innerHTML = '<div class="text-center p-3 text-muted">No collections created yet</div>';
    return;
  }
  
  // Calculate group counts for each collection
  collections.forEach(collection => {
    collection.count = groups.filter(group => 
      group.collectionIds && group.collectionIds.includes(collection.id)
    ).length;
  });
  
  collections.forEach(collection => {
    const template = document.getElementById('collection-item-template');
    if (!template) {
      console.error('Collection item template not found');
      return;
    }
    
    const clone = document.importNode(template.content, true);
    
    // Set collection name
    const nameElement = clone.querySelector('.collection-name');
    if (nameElement) {
      nameElement.textContent = collection.name;
    }
    
    // Set group count
    const countElement = clone.querySelector('.collection-count');
    if (countElement) {
      countElement.textContent = `${collection.count} groups`;
    }
    
    // Add collection ID
    const item = clone.querySelector('.collection-item');
    if (item) {
      item.dataset.id = collection.id;
    }
    
    // Add remove button event
    const removeBtn = clone.querySelector('.remove-collection-btn');
    if (removeBtn) {
      removeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        removeCollection(collection.id);
      });
    }
    
    container.appendChild(clone);
  });
}

/**
 * Remove collection
 */
function removeCollection(collectionId) {
  if (!confirm('Are you sure you want to delete this collection? Groups will not be deleted.')) {
    return;
  }
  
  // Remove collection
  collections = collections.filter(collection => collection.id !== collectionId);
  
  // Remove collection from groups
  groups.forEach(group => {
    if (group.collectionIds) {
      group.collectionIds = group.collectionIds.filter(id => id !== collectionId);
    }
  });
  
  // Save collections and groups
  saveCollections();
  saveGroups();
  
  // Update UI
  renderCollections();
  populateCollectionDropdowns();
  
  // If current collection is the one being deleted, switch to 'all'
  if (currentCollection === collectionId) {
    currentCollection = 'all';
    const groupCollectionSelect = document.getElementById('group-collection-select');
    if (groupCollectionSelect) {
      groupCollectionSelect.value = 'all';
    }
    renderGroups();
  }
}

/**
 * Check if schedule section elements exist and initialize them
 */
function initializeScheduleSection() {
  // Make sure the schedule section is visible
  const scheduleSection = document.getElementById('schedule-section');
  if (scheduleSection) {
    scheduleSection.style.display = 'block';
  }

  // Set up the enable-scheduling checkbox listener
  const enableScheduling = document.getElementById('enable-scheduling');
  const schedulingOptions = document.getElementById('scheduling-options');
  
  if (enableScheduling && schedulingOptions) {
    enableScheduling.addEventListener('change', function() {
      schedulingOptions.style.display = enableScheduling.checked ? 'block' : 'none';
    });
    
    // Check if it should be displayed now
    schedulingOptions.style.display = enableScheduling.checked ? 'block' : 'none';
  }

  // Set up the enable-recurring checkbox listener
  const enableRecurring = document.getElementById('enable-recurring');
  const recurringOptions = document.getElementById('recurring-options');
  
  if (enableRecurring && recurringOptions) {
    enableRecurring.addEventListener('change', function() {
      recurringOptions.style.display = enableRecurring.checked ? 'block' : 'none';
    });
    
    // Check if it should be displayed now
    recurringOptions.style.display = enableRecurring.checked ? 'block' : 'none';
  }
  
  // Set default schedule time to one hour from now
  const scheduleTime = document.getElementById('schedule-time');
  if (scheduleTime && !scheduleTime.value) {
    const now = new Date();
    now.setHours(now.getHours() + 1);
    // Format to local datetime string that works with datetime-local input
    const dateStr = now.toISOString().slice(0, 16);
    scheduleTime.value = dateStr;
  }

  // Make sure the schedule post button works
  const scheduleBtn = document.getElementById('schedule-btn');
  if (scheduleBtn) {
    scheduleBtn.addEventListener('click', schedulePost);
  }
}

/**
 * Prompt for new collection name
 */
function promptNewCollection(targetSelect) {
  const name = prompt('Enter collection name:');
  if (!name || name.trim() === '') return;
  
  // Create collection with unique ID
  const collection = {
    id: 'coll_' + Date.now(),
    name: name.trim(),
    count: 0
  };
  
  // Add to collections
  collections.push(collection);
  
  // Save collections
  saveCollections();
  
  // Update collection select
  populateCollectionDropdowns();
  
  // Set current selection
  const selectElement = document.getElementById(targetSelect);
  if (selectElement) {
    selectElement.value = collection.id;
  }
}

/**
 * Save collections to storage
 */
function saveCollections() {
  chrome.storage.local.set({ groupCollections: collections }, () => {
    console.log('Collections saved successfully');
  });
}

/**
 * Setup collection-related event listeners
 */
function setupCollectionEventListeners() {
  // Create collection button in single group form
  const createCollectionBtn = document.getElementById('create-collection-btn');
  if (createCollectionBtn) {
    createCollectionBtn.addEventListener('click', () => promptNewCollection('group-collection'));
  }
  
  // Create collection button in bulk import form
  const bulkCreateCollectionBtn = document.getElementById('bulk-create-collection-btn');
  if (bulkCreateCollectionBtn) {
    bulkCreateCollectionBtn.addEventListener('click', () => promptNewCollection('bulk-collection'));
  }
  
  // Add collection button in collection management modal
  const addCollectionBtn = document.getElementById('add-collection-btn');
  if (addCollectionBtn) {
    addCollectionBtn.addEventListener('click', addNewCollection);
  }
  
  // Close collections modal button
  const closeCollectionsModalBtn = document.getElementById('close-collections-modal');
  if (closeCollectionsModalBtn) {
    closeCollectionsModalBtn.addEventListener('click', closeCollectionsModal);
  }
  
  // Close collections button
  const closeCollectionsBtn = document.getElementById('close-collections-btn');
  if (closeCollectionsBtn) {
    closeCollectionsBtn.addEventListener('click', closeCollectionsModal);
  }
  
  // Add group manual button handlers
  const addGroupBtn = document.getElementById('add-group-btn');
  if (addGroupBtn) {
    addGroupBtn.addEventListener('click', addGroupManually);
  }
  
  // Close add group modal button
  const closeAddGroupModalBtn = document.getElementById('close-add-group-modal');
  if (closeAddGroupModalBtn) {
    closeAddGroupModalBtn.addEventListener('click', closeAddGroupModal);
  }
  
  // Cancel add group button
  const cancelAddGroupBtn = document.getElementById('cancel-add-group-btn');
  if (cancelAddGroupBtn) {
    cancelAddGroupBtn.addEventListener('click', closeAddGroupModal);
  }
  
  // Import file input handler
  const bulkImportFile = document.getElementById('bulk-import-file');
  if (bulkImportFile) {
    bulkImportFile.addEventListener('change', handleFileImport);
  }
}

/**
 * Helper to get post content text regardless of format
 */
function getPostContentText(content) {
  if (Array.isArray(content)) {
    if (content.length === 0) return '';
    return typeof content[0] === 'string' ? content[0] : 
           content[0].text ? content[0].text : '';
  } else {
    return typeof content === 'string' ? content : 
           content && content.text ? content.text : '';
  }
}

/**
 * Create edit section elements for a scheduled post
 */
function createEditSectionElements(editSection, post) {
  // Create a container for posts editing
  const postsContainer = document.createElement('div');
  postsContainer.className = 'edit-posts-container';

  // Check if we have multiple posts to edit
  if (Array.isArray(post.content) && post.content.length > 1) {
    // Add title for multiple posts
    const multiplePostsTitle = document.createElement('h6');
    multiplePostsTitle.className = 'mt-2 mb-3';
    multiplePostsTitle.textContent = 'Edit Multiple Posts';
    editSection.appendChild(multiplePostsTitle);

    // Create a container with scrollable area for multiple posts
    const scrollableContainer = document.createElement('div');
    scrollableContainer.className = 'multiple-posts-edit-area mb-3';
    scrollableContainer.style.maxHeight = '300px';
    scrollableContainer.style.overflowY = 'auto';
    scrollableContainer.style.border = '1px solid #dee2e6';
    scrollableContainer.style.borderRadius = '0.25rem';
    scrollableContainer.style.padding = '10px';

    // Add each post to edit area
    post.content.forEach((singlePost, index) => {
      const postEditWrapper = document.createElement('div');
      postEditWrapper.className = 'post-edit-item mb-3 pb-3';
      if (index > 0) {
        postEditWrapper.style.borderTop = '1px solid #dee2e6';
        postEditWrapper.style.paddingTop = '15px';
      }

      // Post number label
      const postNumberLabel = document.createElement('div');
      postNumberLabel.className = 'mb-2 fw-bold';
      postNumberLabel.textContent = `Post #${index + 1}`;
      postEditWrapper.appendChild(postNumberLabel);

      // Text content
      const textGroup = document.createElement('div');
      textGroup.className = 'form-group mb-3';
      
      const textLabel = document.createElement('label');
      textLabel.textContent = 'Text:';
      textLabel.htmlFor = `edit-content-${post.id}-${index}`;
      textLabel.className = 'form-label';
      textGroup.appendChild(textLabel);
      
      const contentInput = document.createElement('textarea');
      contentInput.className = 'form-control post-content-input';
      contentInput.id = `edit-content-${post.id}-${index}`;
      contentInput.rows = 3;
      contentInput.dataset.postIndex = index;
      contentInput.value = singlePost.text || '';
      textGroup.appendChild(contentInput);
      
      postEditWrapper.appendChild(textGroup);

      // Images section
      if (singlePost.images && singlePost.images.length > 0) {
        const imagesGroup = document.createElement('div');
        imagesGroup.className = 'form-group mb-3';
        
        const imagesLabel = document.createElement('label');
        imagesLabel.textContent = 'Images:';
        imagesLabel.className = 'form-label';
        imagesGroup.appendChild(imagesLabel);
        
        const imagesPreview = document.createElement('div');
        imagesPreview.className = 'post-images-preview d-flex flex-wrap';
        
        singlePost.images.forEach((imgSrc, imgIndex) => {
          const imageWrapper = document.createElement('div');
          imageWrapper.className = 'post-image-item position-relative me-2 mb-2';
          imageWrapper.style.width = '100px';
          imageWrapper.style.height = '100px';
          
          const img = document.createElement('img');
          img.src = imgSrc;
          img.className = 'img-thumbnail';
          img.style.width = '100%';
          img.style.height = '100%';
          img.style.objectFit = 'cover';
          
          const removeBtn = document.createElement('button');
          removeBtn.className = 'btn btn-danger btn-sm position-absolute';
          removeBtn.innerHTML = '&times;';
          removeBtn.style.top = '5px';
          removeBtn.style.right = '5px';
          removeBtn.style.padding = '0 6px';
          removeBtn.addEventListener('click', () => {
            // Remove image from preview and from post data
            imageWrapper.remove();
            post.content[index].images.splice(imgIndex, 1);
          });
          
          imageWrapper.appendChild(img);
          imageWrapper.appendChild(removeBtn);
          imagesPreview.appendChild(imageWrapper);
        });
        
        imagesGroup.appendChild(imagesPreview);
        postEditWrapper.appendChild(imagesGroup);
      }

      // Add image upload capability for each post
      const uploadGroup = document.createElement('div');
      uploadGroup.className = 'form-group mb-3';
      
      const uploadLabel = document.createElement('label');
      uploadLabel.textContent = 'Add Images:';
      uploadLabel.className = 'form-label';
      uploadLabel.htmlFor = `edit-image-upload-${post.id}-${index}`;
      uploadGroup.appendChild(uploadLabel);
      
      const uploadInput = document.createElement('input');
      uploadInput.type = 'file';
      uploadInput.multiple = true;
      uploadInput.accept = 'image/*';
      uploadInput.className = 'form-control post-image-upload';
      uploadInput.id = `edit-image-upload-${post.id}-${index}`;
      uploadInput.dataset.postIndex = index;
      
      // Handle image upload for this specific post
      uploadInput.addEventListener('change', (event) => {
        const files = event.target.files;
        const postIndex = parseInt(event.target.dataset.postIndex);
        
        if (!files || files.length === 0) return;
        
        const fileArray = Array.from(files);
        Promise.all(fileArray.map(file => readFileAsDataURL(file)))
          .then(dataURLs => {
            // Initialize images array if it doesn't exist
            if (!post.content[postIndex].images) {
              post.content[postIndex].images = [];
            }
            
            // Add new images to this post
            post.content[postIndex].images.push(...dataURLs);
            
            // Reload the edit section to show new images
            const currentEditSection = editSection;
            currentEditSection.innerHTML = '';
            createEditSectionElements(currentEditSection, post);
          });
        
        // Clear input to allow uploading same images again
        event.target.value = '';
      });
      
      uploadGroup.appendChild(uploadInput);
      postEditWrapper.appendChild(uploadGroup);

      scrollableContainer.appendChild(postEditWrapper);
    });

    editSection.appendChild(scrollableContainer);
  } else {
    // Single post editing
    const contentGroup = document.createElement('div');
    contentGroup.className = 'form-group mb-3';
    
    const contentLabel = document.createElement('label');
    contentLabel.textContent = 'Post content:';
    contentLabel.htmlFor = `edit-content-${post.id}`;
    contentLabel.className = 'form-label';
    contentGroup.appendChild(contentLabel);
    
    const contentInput = document.createElement('textarea');
    contentInput.className = 'form-control';
    contentInput.id = `edit-content-${post.id}`;
    contentInput.rows = 3;
    
    // Set text value for single post
    const singlePost = Array.isArray(post.content) ? post.content[0] : post.content;
    contentInput.value = singlePost.text || '';
    contentGroup.appendChild(contentInput);
    editSection.appendChild(contentGroup);
    
    // Image preview for single post
    const images = Array.isArray(post.content) 
      ? (post.content[0].images || []) 
      : (post.content.images || []);
    
    if (images.length > 0) {
      const imagesGroup = document.createElement('div');
      imagesGroup.className = 'form-group mb-3';
      
      const imagesLabel = document.createElement('label');
      imagesLabel.textContent = 'Images:';
      imagesLabel.className = 'form-label';
      imagesGroup.appendChild(imagesLabel);
      
      const imagesPreview = document.createElement('div');
      imagesPreview.className = 'post-images-preview d-flex flex-wrap';
      
      images.forEach((imgSrc, imgIndex) => {
        const imageWrapper = document.createElement('div');
        imageWrapper.className = 'post-image-item position-relative me-2 mb-2';
        imageWrapper.style.width = '100px';
        imageWrapper.style.height = '100px';
        
        const img = document.createElement('img');
        img.src = imgSrc;
        img.className = 'img-thumbnail';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn btn-danger btn-sm position-absolute';
        removeBtn.innerHTML = '&times;';
        removeBtn.style.top = '5px';
        removeBtn.style.right = '5px';
        removeBtn.style.padding = '0 6px';
        removeBtn.addEventListener('click', () => {
          // Remove image from preview and from post data
          imageWrapper.remove();
          if (Array.isArray(post.content)) {
            post.content[0].images.splice(imgIndex, 1);
          } else {
            post.content.images.splice(imgIndex, 1);
          }
        });
        
        imageWrapper.appendChild(img);
        imageWrapper.appendChild(removeBtn);
        imagesPreview.appendChild(imageWrapper);
      });
      
      imagesGroup.appendChild(imagesPreview);
      editSection.appendChild(imagesGroup);
    }
    
    // Add image upload for single post
    const uploadGroup = document.createElement('div');
    uploadGroup.className = 'form-group mb-3';
    
    const uploadLabel = document.createElement('label');
    uploadLabel.textContent = 'Add Images:';
    uploadLabel.className = 'form-label';
    uploadLabel.htmlFor = `edit-image-upload-${post.id}`;
    uploadGroup.appendChild(uploadLabel);
    
    const uploadInput = document.createElement('input');
    uploadInput.type = 'file';
    uploadInput.multiple = true;
    uploadInput.accept = 'image/*';
    uploadInput.className = 'form-control';
    uploadInput.id = `edit-image-upload-${post.id}`;
    
    // Handle image upload for single post
    uploadInput.addEventListener('change', (event) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;
      
      const fileArray = Array.from(files);
      Promise.all(fileArray.map(file => readFileAsDataURL(file)))
        .then(dataURLs => {
          // Initialize images array if it doesn't exist
          if (Array.isArray(post.content)) {
            if (!post.content[0].images) {
              post.content[0].images = [];
            }
            post.content[0].images.push(...dataURLs);
          } else {
            if (!post.content.images) {
              post.content.images = [];
            }
            post.content.images.push(...dataURLs);
          }
          
          // Reload the edit section to show new images
          const currentEditSection = editSection;
          currentEditSection.innerHTML = '';
          createEditSectionElements(currentEditSection, post);
        });
      
      // Clear input to allow uploading same images again
      event.target.value = '';
    });
    
    uploadGroup.appendChild(uploadInput);
    editSection.appendChild(uploadGroup);
  }
  
  // Edit time field
  const timeGroup = document.createElement('div');
  timeGroup.className = 'form-group mb-3';
  
  const timeLabel = document.createElement('label');
  timeLabel.textContent = 'Post time:';
  timeLabel.htmlFor = `edit-time-${post.id}`;
  timeGroup.appendChild(timeLabel);
  
  const timeInput = document.createElement('input');
  timeInput.type = 'datetime-local';
  timeInput.className = 'form-control';
  timeInput.id = `edit-time-${post.id}`;
  
  const scheduleDateISO = new Date(post.scheduleTime);
  timeInput.value = scheduleDateISO.toISOString().slice(0, 16);
  
  timeGroup.appendChild(timeInput);
  editSection.appendChild(timeGroup);
  
  // Add recurring options
  addRecurringOptions(editSection, post);
  
  // Save and cancel buttons
  const editButtonsDiv = document.createElement('div');
  editButtonsDiv.className = 'd-flex justify-content-end mt-3';
  
  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn btn-sm btn-primary save-edit-btn';
  saveBtn.textContent = 'Save changes';
  
  // Store a reference to the parent element to use in event handlers
  const parentElement = editSection.parentElement;
  
  saveBtn.addEventListener('click', () => {
    const postElement = parentElement || editSection.closest('.scheduled-post');
    saveEditChanges(post.id, postElement);
  });
  
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn btn-sm btn-secondary cancel-edit-btn ms-2';
  cancelBtn.textContent = 'Cancel';
  
  cancelBtn.addEventListener('click', () => {
    const postElement = parentElement || editSection.closest('.scheduled-post');
    toggleEditMode(post, postElement);
  });
  
  editButtonsDiv.appendChild(saveBtn);
  editButtonsDiv.appendChild(cancelBtn);
  editSection.appendChild(editButtonsDiv);
}

/**
 * Add recurring options to the edit section
 */
function addRecurringOptions(editSection, post) {
  // Recurring options
  const recurringGroup = document.createElement('div');
  recurringGroup.className = 'mb-2';
  
  const recurringCheckDiv = document.createElement('div');
  recurringCheckDiv.className = 'form-check';
  
  const recurringCheck = document.createElement('input');
  recurringCheck.type = 'checkbox';
  recurringCheck.className = 'form-check-input';
  recurringCheck.id = `edit-recurring-${post.id}`;
  recurringCheck.checked = post.recurring !== null;
  
  const recurringLabel = document.createElement('label');
  recurringLabel.className = 'form-check-label';
  recurringLabel.htmlFor = `edit-recurring-${post.id}`;
  recurringLabel.textContent = 'Post recurring';
  
  recurringCheckDiv.appendChild(recurringCheck);
  recurringCheckDiv.appendChild(recurringLabel);
  recurringGroup.appendChild(recurringCheckDiv);
  
  // Recurring options (show/hide based on selection state)
  const recurringOptions = document.createElement('div');
  recurringOptions.className = 'recurring-options mt-2 border p-2 rounded';
  recurringOptions.style.display = post.recurring !== null ? 'block' : 'none';
  
  // Add change listener for showing/hiding recurring options
  recurringCheck.addEventListener('change', () => {
    recurringOptions.style.display = recurringCheck.checked ? 'block' : 'none';
  });
  
  // Recurring type options
  const typeDiv = document.createElement('div');
  typeDiv.className = 'mb-2';
  typeDiv.textContent = 'Recurring type:';
  
  // Create recurring options (daily, weekly, monthly)
  const types = [
    { id: 'daily', label: 'Daily' },
    { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' }
  ];
  
  types.forEach(type => {
    const typeOptionDiv = document.createElement('div');
    typeOptionDiv.className = 'form-check';
    
    const typeRadio = document.createElement('input');
    typeRadio.type = 'radio';
    typeRadio.className = 'form-check-input';
    typeRadio.name = `edit-recurring-type-${post.id}`;
    typeRadio.id = `edit-recurring-${type.id}-${post.id}`;
    typeRadio.value = type.id;
    
    if (post.recurring && post.recurring.type === type.id) {
      typeRadio.checked = true;
    } else if (!post.recurring && type.id === 'daily') {
      typeRadio.checked = true;
    }
    
    const typeLabel = document.createElement('label');
    typeLabel.className = 'form-check-label';
    typeLabel.htmlFor = `edit-recurring-${type.id}-${post.id}`;
    typeLabel.textContent = type.label;
    
    typeOptionDiv.appendChild(typeRadio);
    typeOptionDiv.appendChild(typeLabel);
    typeDiv.appendChild(typeOptionDiv);
  });
  
  recurringOptions.appendChild(typeDiv);
  
  // Recurring count field
  const countGroup = document.createElement('div');
  countGroup.className = 'form-group mt-2';
  
  const countLabel = document.createElement('label');
  countLabel.htmlFor = `edit-recurring-count-${post.id}`;
  countLabel.textContent = 'Recurring count:';
  countGroup.appendChild(countLabel);
  
  const countInput = document.createElement('input');
  countInput.type = 'number';
  countInput.className = 'form-control';
  countInput.id = `edit-recurring-count-${post.id}`;
  countInput.min = 1;
  countInput.value = post.recurring ? post.recurring.count : 1;
  countGroup.appendChild(countInput);
  
  recurringOptions.appendChild(countGroup);
  recurringGroup.appendChild(recurringOptions);
  editSection.appendChild(recurringGroup);
} 
/**
 * FBGroupMaster
 * Service Worker file for the extension
 */

// Track extension window
let extensionWindow = null;

// Listen for extension icon click
chrome.action.onClicked.addListener((tab) => {
  // Check if window is already open
  if (extensionWindow) {
    // Check if the window still exists
    chrome.windows.get(extensionWindow.id, {}, (win) => {
      if (chrome.runtime.lastError) {
        // Window doesn't exist anymore, create a new one
        createExtensionWindow();
      } else {
        // Window exists, focus it
        chrome.windows.update(extensionWindow.id, { focused: true });
      }
    });
  } else {
    // Create new window
    createExtensionWindow();
  }
});

/**
 * Create new extension window
 */
function createExtensionWindow() {
  // التحقق من وجود ترخيص صالح قبل فتح النافذة
  checkLicense().then(licenseValid => {
    // تحديد الصفحة التي سيتم فتحها
    const pageToOpen = licenseValid ? 'popup.html' : 'license.html';
    
    chrome.windows.create({
      url: pageToOpen,
      type: 'popup',
      width: 800,
      height: 700
    }, (window) => {
      extensionWindow = window;
    });
  });
}

/**
 * التحقق من صلاحية الترخيص
 * @returns {Promise<boolean>} وعد يتم حله بقيمة boolean تشير إلى صلاحية الترخيص
 */
function checkLicense() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['license'], function(result) {
      // التحقق من وجود بيانات الترخيص
      if (!result.license || !result.license.key || !result.license.valid) {
        console.log('No valid license found');
        resolve(false);
        return;
      }
      
      // التحقق من تاريخ انتهاء الترخيص
      const expiryDate = new Date(result.license.expiry);
      const now = new Date();
      
      if (expiryDate < now) {
        console.log('License has expired');
        resolve(false);
        return;
      }
      
      // التحقق من معرف الجهاز (لمنع نقل الترخيص)
      const currentDeviceId = generateDeviceId();
      if (result.license.deviceId && result.license.deviceId !== currentDeviceId) {
        console.log('Device ID mismatch');
        resolve(false);
        return;
      }
      
      console.log('Valid license found');
      resolve(true);
    });
  });
}

/**
 * إنشاء معرّف فريد للجهاز
 * @returns {string} معرّف الجهاز
 */
function generateDeviceId() {
  // استخدام معلومات المتصفح لإنشاء معرّف
  const navigator_info = navigator.userAgent;
  const screen_info = {
    height: screen.height || '',
    width: screen.width || '',
    pixelDepth: screen.pixelDepth || ''
  };
  
  let uid = navigator_info.replace(/\D+/g, '');
  uid += screen_info.height;
  uid += screen_info.width;
  uid += screen_info.pixelDepth;
  
  // تحويل المعرف إلى سلسلة أكثر أمانًا
  return btoa(uid).substring(0, 32);
}

// Current posting state
const postState = {
  isPosting: false,
  postsCompleted: 0,
  totalPosts: 0,
  remainingGroups: [],
  currentPost: null,
  currentImages: [],
  multiplePosts: [],
  useRandomSelection: false,
  scheduledPosts: [],
  failedGroups: [],
  // Posting interval settings
  postingSettings: {
    intervalMin: 30,
    intervalMax: 60,
    enablePause: false,
    postsBeforePause: 5,
    pauseDuration: 15
  },
  // Status tracking
  nextPostTime: null,
  statusMessage: null,
  isPaused: false,
  // حفظ حالة النشر في التخزين المحلي
  lastSavedState: null,
  // تتبع علامات التبويب المفتوحة
  openTabs: {}
};

// حفظ حالة النشر في التخزين المحلي
function savePostingState() {
  // حفظ الحالة الحالية
  const stateToSave = {
    isPosting: postState.isPosting,
    postsCompleted: postState.postsCompleted,
    totalPosts: postState.totalPosts,
    remainingGroups: postState.remainingGroups,
    multiplePosts: postState.multiplePosts,
    useRandomSelection: postState.useRandomSelection,
    postingSettings: postState.postingSettings,
    nextPostTime: postState.nextPostTime,
    statusMessage: postState.statusMessage,
    isPaused: postState.isPaused,
    failedGroups: postState.failedGroups
  };
  
  // حفظ الحالة في التخزين المحلي
  chrome.storage.local.set({ postingState: stateToSave }, () => {
    console.log("Posting state saved to storage");
    postState.lastSavedState = stateToSave;
  });
}

// استعادة حالة النشر من التخزين المحلي
function restorePostingState() {
  chrome.storage.local.get(['postingState'], (result) => {
    if (result.postingState) {
      const savedState = result.postingState;
      
      // استعادة الحالة
      postState.isPosting = savedState.isPosting;
      postState.postsCompleted = savedState.postsCompleted;
      postState.totalPosts = savedState.totalPosts;
      postState.remainingGroups = savedState.remainingGroups;
      postState.multiplePosts = savedState.multiplePosts;
      postState.useRandomSelection = savedState.useRandomSelection;
      postState.postingSettings = savedState.postingSettings;
      postState.nextPostTime = savedState.nextPostTime;
      postState.statusMessage = savedState.statusMessage;
      postState.isPaused = savedState.isPaused;
      postState.failedGroups = savedState.failedGroups;
      
      // استعادة علامات التبويب المفتوحة
      if (savedState.openTabs) {
        postState.openTabs = savedState.openTabs;
        
        // التحقق من وجود علامات التبويب المفتوحة
        if (Object.keys(postState.openTabs).length > 0) {
          console.log("Found open tabs from previous session, checking if they still exist...");
          
          // التحقق من وجود علامات التبويب المفتوحة
          chrome.tabs.query({}, (tabs) => {
            const existingTabIds = tabs.map(tab => tab.id);
            const tabsToClose = [];
            
            // التحقق من كل علامة تبويب محفوظة
            for (const [groupUrl, tabId] of Object.entries(postState.openTabs)) {
              if (!existingTabIds.includes(tabId)) {
                console.log(`Tab for group ${groupUrl} (ID: ${tabId}) no longer exists`);
                tabsToClose.push(groupUrl);
              } else {
                console.log(`Tab for group ${groupUrl} (ID: ${tabId}) still exists`);
              }
            }
            
            // حذف علامات التبويب التي لم تعد موجودة
            for (const groupUrl of tabsToClose) {
              delete postState.openTabs[groupUrl];
            }
            
            // حفظ الحالة المحدثة
            savePostingState();
          });
        }
      }
      
      console.log("Posting state restored from storage");
      
      // إذا كانت عملية النشر جارية، استئنافها
      if (postState.isPosting) {
        console.log("Resuming posting process...");
        
        // التحقق من وقت النشر التالي
        if (postState.nextPostTime) {
          const now = Date.now();
          const timeUntilNextPost = postState.nextPostTime - now;
          
          if (timeUntilNextPost > 0) {
            console.log(`Scheduling next post in ${Math.round(timeUntilNextPost/1000)} seconds`);
            setTimeout(postToNextGroup, timeUntilNextPost);
          } else {
            // إذا كان وقت النشر التالي قد مر، بدء النشر فورًا
            console.log("Next post time has passed, starting immediately");
            postToNextGroup();
          }
        } else {
          // إذا لم يكن هناك وقت للنشر التالي، بدء النشر فورًا
          console.log("No next post time, starting immediately");
          postToNextGroup();
        }
      }
    }
  });
}

// حفظ الحالة عند إغلاق النافذة
chrome.windows.onRemoved.addListener((windowId) => {
  if (extensionWindow && extensionWindow.id === windowId) {
    console.log("Extension window closed, saving state");
    savePostingState();
    extensionWindow = null;
  }
});

// حفظ الحالة بشكل دوري
setInterval(() => {
  if (postState.isPosting) {
    savePostingState();
  }
}, 30000); // حفظ كل 30 ثانية

// استعادة الحالة عند بدء تشغيل الخدمة
chrome.runtime.onStartup.addListener(() => {
  console.log("Extension started, restoring state");
  restorePostingState();
});

// استعادة الحالة عند تثبيت أو تحديث الإضافة
chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed or updated, restoring state");
  restorePostingState();
  
  // Initialize scheduled posts if not exists
  chrome.storage.local.get(['scheduledPosts'], result => {
    if (!result.scheduledPosts) {
      chrome.storage.local.set({ scheduledPosts: [] });
    }
  });
});

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Message received:", message.action);

  switch(message.action) {
    case "postToGroups":
    case "startPosting": // Handle both old and new action names for backward compatibility
      handlePostToGroups(message, sendResponse);
      return true;
      
    case "stopPosting":
      handleStopPosting(sendResponse);
      return true;
      
    case "getPostingStatus":
      sendResponse({
        isPosting: postState.isPosting,
        postsCompleted: postState.postsCompleted,
        totalPosts: postState.totalPosts,
        remainingGroups: postState.remainingGroups.length,
        statusMessage: postState.statusMessage,
        nextPostTime: postState.nextPostTime
      });
      return true;
      
    case "schedulePost":
      handleSchedulePost(message, sendResponse);
      return true;
      
    case "getScheduledPosts":
      getScheduledPosts(sendResponse);
      return true;
      
    case "deleteScheduledPost":
      deleteScheduledPost(message.postId, sendResponse);
      return true;
      
    case "getScheduledPostById":
      getScheduledPostById(message.postId, sendResponse);
      return true;
      
    case "updateScheduledPost":
      updateScheduledPost(message.postId, message.updatedPost, sendResponse);
      return true;
  }
});

/**
 * Handle posting to groups
 */
function handlePostToGroups(message, sendResponse) {
  if (postState.isPosting) {
    sendResponse({ success: false, message: "A posting process is already in progress" });
    return;
  }
  
  // Handle the structure based on new startPosting action
  const groups = message.groups;
  
  // Get interval and pause settings
  const intervalSettings = message.intervalSettings || {};
  const pauseSettings = message.pauseSettings || {};
  
  // Ensure we're using the correct properties regardless of message structure
  const postingSettings = {
    intervalMin: intervalSettings.min || intervalSettings.intervalMin || message.postingSettings?.intervalMin || 30,
    intervalMax: intervalSettings.max || intervalSettings.intervalMax || message.postingSettings?.intervalMax || 60,
    random: intervalSettings.random || message.isRandom === true || false,
    enablePause: pauseSettings.enable || message.postingSettings?.enablePause || false,
    postsBeforePause: pauseSettings.postsBeforePause || message.postingSettings?.postsBeforePause || 5,
    pauseDuration: pauseSettings.pauseDuration || message.postingSettings?.pauseDuration || 15
  };
  
  console.log("Posting settings:", postingSettings);
    
  // Determine content based on message structure
  let content = message.content;
  let isRandom = message.isRandom;
  
  // Handle new structure from startPosting
  if (message.enableMultiplePosts !== undefined) {
    content = message.posts;
    isRandom = message.randomSelection;
  }
  
  if (!groups || groups.length === 0) {
    sendResponse({ success: false, message: "Please select groups to post to" });
    return;
  }
  
  if (!content || (Array.isArray(content) && content.length === 0)) {
    sendResponse({ success: false, message: "Please add post content" });
    return;
  }
  
  // Update posting state
  postState.isPosting = true;
  postState.postsCompleted = 0;
  postState.totalPosts = groups.length;
  postState.remainingGroups = [...groups];
  postState.isPaused = false;
  
  // Save posting settings
  postState.postingSettings = {
    intervalMin: postingSettings.intervalMin,
    intervalMax: postingSettings.intervalMax,
    random: postingSettings.random,
    enablePause: postingSettings.enablePause,
    postsBeforePause: postingSettings.postsBeforePause,
    pauseDuration: postingSettings.pauseDuration
  };
  
  console.log(`Posting settings: intervals ${postState.postingSettings.intervalMin}-${postState.postingSettings.intervalMax} seconds, random: ${postState.postingSettings.random}`);
  
  if (Array.isArray(content)) {
    // If content is an array of posts
    postState.multiplePosts = content;
    // Set random selection based on data from popup.js
    postState.useRandomSelection = isRandom === true;
    console.log(`Random selection state: ${postState.useRandomSelection ? 'enabled' : 'disabled'}`);
  } else {
    // If content is a single post
    postState.multiplePosts = [content];
    postState.useRandomSelection = false;
  }
  
  // حفظ الحالة في التخزين المحلي
  savePostingState();
  
  // Start posting process
  sendResponse({ success: true, message: `Starting to post to ${groups.length} groups` });
  
  // Start sequential posting
  postState.statusMessage = "Preparing to post...";
  scheduleNextPost();
}

/**
 * Handle stop posting request
 */
function handleStopPosting(sendResponse) {
  if (!postState.isPosting) {
    sendResponse({ success: false, message: "No posting process is currently running" });
    return;
  }
  
  postState.isPosting = false;
  postState.statusMessage = "Posting process stopped";
  postState.nextPostTime = null;
  
  sendResponse({ success: true, message: "Posting process stopped successfully" });
}

/**
 * Schedule the next post with the appropriate delay
 */
function scheduleNextPost() {
  if (!postState.isPosting) {
    return;
  }
  
  // If there are no more groups to post to
  if (postState.remainingGroups.length === 0) {
    // End the posting process
    postState.isPosting = false;
    postState.statusMessage = "Posting completed";
    postState.nextPostTime = null;
    
    // حفظ الحالة في التخزين المحلي
    savePostingState();
    
    // Send completion notification
    try {
      chrome.runtime.sendMessage({
        action: "postingComplete",
        postsCompleted: postState.postsCompleted
      }).catch(error => {
        console.log("Failed to send posting completion message:", error);
        // لا نقوم بأي شيء هنا، فقط نسجل الخطأ
      });
    } catch (error) {
      console.error("Exception when sending posting completion message:", error);
      // لا نقوم بأي شيء هنا، فقط نسجل الخطأ
    }
    
    return;
  }
  
  // Check if we need to pause after a certain number of posts
  if (postState.postingSettings.enablePause && 
      postState.postsCompleted > 0 && 
      postState.postsCompleted % postState.postingSettings.postsBeforePause === 0 &&
      !postState.isPaused) {
    
    // Calculate pause end time
    const pauseDurationMs = postState.postingSettings.pauseDuration * 60 * 1000; // Convert minutes to milliseconds
    const pauseEndTime = new Date(Date.now() + pauseDurationMs);
    
    postState.isPaused = true;
    postState.statusMessage = `Pausing for ${postState.postingSettings.pauseDuration} minutes...`;
    postState.nextPostTime = pauseEndTime.getTime();
    
    // حفظ الحالة في التخزين المحلي
    savePostingState();
    
    // Update UI
    try {
      chrome.runtime.sendMessage({
        action: "postingProgress",
        completed: postState.postsCompleted,
        total: postState.totalPosts,
        statusMessage: postState.statusMessage,
        nextPostTime: postState.nextPostTime
      }).catch(error => {
        console.log("Error updating posting progress:", error);
        // لا نقوم بأي شيء هنا، فقط نسجل الخطأ
      });
    } catch (error) {
      console.error("Exception when updating posting progress:", error);
      // لا نقوم بأي شيء هنا، فقط نسجل الخطأ
    }
    
    // Schedule next post after pause
    console.log(`Pausing for ${postState.postingSettings.pauseDuration} minutes after posting to ${postState.postsCompleted} groups`);
    setTimeout(() => {
      postState.isPaused = false;
      postState.statusMessage = "Resuming posting...";
      postToNextGroup();
    }, pauseDurationMs);
    
    return;
  }
  
  // Get interval settings
  const intervalMin = postState.postingSettings.intervalMin * 1000; // Convert to milliseconds
  const intervalMax = postState.postingSettings.intervalMax * 1000; // Convert to milliseconds
  
  // Calculate delay between posts
  let delayMs;
  
  if (postState.postingSettings.random) {
    // Apply true random delay between min and max
    delayMs = getRandomDelay(intervalMin / 1000, intervalMax / 1000) * 1000;
    console.log(`Using random delay: ${delayMs/1000} seconds (between ${intervalMin/1000}-${intervalMax/1000} seconds)`);
  } else {
    // Use fixed delay (average of min and max if they differ)
    delayMs = intervalMin === intervalMax ? intervalMin : Math.floor((intervalMin + intervalMax) / 2);
    console.log(`Using fixed delay: ${delayMs/1000} seconds`);
  }
  
  // Set next post time
  const nextTime = new Date(Date.now() + delayMs);
  postState.nextPostTime = nextTime.getTime();
  
  // حفظ الحالة في التخزين المحلي
  savePostingState();
  
  if (postState.postsCompleted === 0) {
    // First post, start immediately
    postState.statusMessage = "Starting first post...";
    postToNextGroup();
  } else {
    // Format delay time for display (in seconds)
    const delaySeconds = Math.round(delayMs/1000);
    
    // Update status message with delay information
    postState.statusMessage = `Waiting ${delaySeconds} seconds until next post...`;
    
    // Update UI with delay information
    try {
      chrome.runtime.sendMessage({
        action: "postingProgress",
        completed: postState.postsCompleted,
        total: postState.totalPosts,
        statusMessage: postState.statusMessage,
        nextPostTime: postState.nextPostTime
      }).catch(error => {
        console.log("Error updating posting progress:", error);
        // لا نقوم بأي شيء هنا، فقط نسجل الخطأ
      });
    } catch (error) {
      console.error("Exception when updating posting progress:", error);
      // لا نقوم بأي شيء هنا، فقط نسجل الخطأ
    }
    
    // Schedule next post after delay
    console.log(`Scheduling next post in ${delayMs/1000} seconds`);
    setTimeout(postToNextGroup, delayMs);
  }
}

/**
 * Post to the next group in the queue
 */
function postToNextGroup() {
  if (!postState.isPosting || postState.remainingGroups.length === 0) {
    // End the posting process
    scheduleNextPost(); // This will handle completion
    return;
  }
  
  // Get the next group
  const nextGroup = postState.remainingGroups.shift();
  
  // Select a post from the array
  let selectedPost;
  
  if (postState.useRandomSelection && postState.multiplePosts.length > 1) {
    // True random selection
    const randomIndex = Math.floor(Math.random() * postState.multiplePosts.length);
    selectedPost = postState.multiplePosts[randomIndex];
  } else if (postState.multiplePosts.length > 1) {
    // Sequential selection - using completion counter as a circular index for the posts array
    const postIndex = postState.postsCompleted % postState.multiplePosts.length;
    selectedPost = postState.multiplePosts[postIndex];
    console.log(`Selecting post #${postIndex+1} of ${postState.multiplePosts.length} posts for group #${postState.postsCompleted+1}`);
  } else {
    // If there's only one post
    selectedPost = postState.multiplePosts[0];
  }
  
  postState.currentPost = selectedPost;
  console.log(`Preparing to post to: ${nextGroup.url}`);
  
  // Update posting status
  postState.statusMessage = `Posting to ${nextGroup.name}...`;
  
  // حفظ الحالة في التخزين المحلي
  savePostingState();
  
  // Update posting progress for the UI
  try {
    chrome.runtime.sendMessage({
      action: "postingProgress",
      completed: postState.postsCompleted,
      total: postState.totalPosts,
      currentGroup: nextGroup.url,
      statusMessage: postState.statusMessage,
      nextPostTime: null // Clear next post time during active posting
    }).catch(error => console.log("Error updating posting progress:", error));
  } catch (error) {
    console.log("Error updating posting progress:", error);
  }
  
  // Open a new tab for the group
  chrome.tabs.create({ url: nextGroup.url, active: false }, (tab) => {
    // حفظ معرف علامة التبويب في حالة النشر
    postState.openTabs[nextGroup.url] = tab.id;
    
    // حفظ الحالة في التخزين المحلي
    savePostingState();
    
    // Listen for the load completion event
    const listener = (tabId, changeInfo) => {
      if (tabId === tab.id && changeInfo.status === 'complete') {
        // Remove the listener
        chrome.tabs.onUpdated.removeListener(listener);
        
        // Send progress update
        try {
          chrome.runtime.sendMessage({
            action: "postingProgress",
            completed: postState.postsCompleted,
            total: postState.totalPosts,
            statusMessage: postState.statusMessage
          }).catch(error => console.log("Error updating posting progress:", error));
        } catch(e) {
          console.log("Error updating posting progress:", e);
        }
        
        // Increase wait time to allow Facebook page to fully load
        // This gives JavaScript on the page time to execute and prepare the Facebook interface
        console.log(`Waiting 15 seconds to ensure page and content script are fully loaded...`);
        setTimeout(() => {
          postToGroup(tab, nextGroup, selectedPost);
        }, 15000); // Increased from 8000 to 15000 milliseconds (15 seconds) to ensure page and content script are fully loaded
      }
    };
    
    chrome.tabs.onUpdated.addListener(listener);
  });
}

/**
 * Attempt to post to a specific group with error handling
 */
function postToGroup(tab, group, post) {
  console.log(`Attempting to post to group: ${group.url}`);
  
  // عدد محاولات تحميل content script
  let scriptRetryCount = 0;
  const maxScriptRetries = 5; // زيادة عدد المحاولات من 3 إلى 5
  
  function attemptPostAfterScriptCheck() {
    // التحقق من وجود content script
    try {
      chrome.tabs.sendMessage(tab.id, { action: "ping" }, function(response) {
        if (chrome.runtime.lastError || !response || !response.success) {
          console.error("Error communicating with content script:", chrome.runtime.lastError?.message || "No valid response");
          
          // إعادة المحاولة إذا لم نتجاوز الحد الأقصى للمحاولات
          if (scriptRetryCount < maxScriptRetries) {
            scriptRetryCount++;
            console.log(`Retry script injection attempt ${scriptRetryCount}/${maxScriptRetries} for group: ${group.name}`);
            
            // زيادة وقت الانتظار بين المحاولات تدريجيًا
            const retryDelay = 5000 * scriptRetryCount;
            console.log(`Waiting ${retryDelay/1000} seconds before retry...`);
            
            // محاولة تنفيذ content script يدوياً
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['js/content.js']
            }).then(() => {
              console.log("Content script executed, waiting for initialization...");
              // زيادة وقت الانتظار للتأكد من تحميل الصفحة
              setTimeout(attemptPostAfterScriptCheck, retryDelay);
            }).catch(error => {
              console.error("Failed to execute content script:", error);
              setTimeout(attemptPostAfterScriptCheck, retryDelay);
            });
          } else {
            console.error(`Maximum script injection attempts (${maxScriptRetries}) reached for group: ${group.name}`);
            handlePostingFailure(tab, group);
          }
        } else {
          // Content script موجود، الاستمرار بالنشر
          console.log("Content script presence confirmed, proceeding with posting...");
          setTimeout(() => {
            sendPostMessage(tab, group, post);
          }, 2000);
        }
      });
    } catch (error) {
      console.error("Exception in attemptPostAfterScriptCheck:", error);
      
      // إعادة المحاولة إذا لم نتجاوز الحد الأقصى للمحاولات
      if (scriptRetryCount < maxScriptRetries) {
        scriptRetryCount++;
        console.log(`Retry after exception ${scriptRetryCount}/${maxScriptRetries} for group: ${group.name}`);
        
        // زيادة وقت الانتظار بين المحاولات تدريجيًا
        const retryDelay = 5000 * scriptRetryCount;
        setTimeout(attemptPostAfterScriptCheck, retryDelay);
        return;
      }
      
      // لقد وصلنا للحد الأقصى من المحاولات
      handlePostingFailure(tab, group);
    }
  }
  
  // إعطاء وقت إضافي للتأكد من تحميل الصفحة قبل التحقق من content script
  setTimeout(attemptPostAfterScriptCheck, 5000); // زيادة وقت الانتظار من 3000 إلى 5000
}

/**
 * Send posting message to content script
 */
function sendPostMessage(tab, group, post) {
  // تتبع عدد المحاولات
  let retryCount = 0;
  const maxRetries = 5; // زيادة عدد المحاولات من 3 إلى 5
  
  function attemptPostMessage() {
    // إضافة معالجة خاصة لأخطاء الاتصال
    try {
      chrome.tabs.sendMessage(tab.id, {
        action: "postToGroup",
        post: post.text || post, // For backward compatibility
        images: post.images || []
      }, (response) => {
        // التحقق من وجود أخطاء اتصال
        if (chrome.runtime.lastError) {
          console.error("Error communicating with content script:", chrome.runtime.lastError.message);
          
          // إعادة المحاولة إذا لم نتجاوز الحد الأقصى للمحاولات
          if (retryCount < maxRetries) {
            retryCount++;
            console.log(`Retry attempt ${retryCount}/${maxRetries} for group: ${group.name}`);
            
            // زيادة وقت الانتظار بين المحاولات تدريجيًا
            const retryDelay = 5000 * retryCount; // زيادة وقت الانتظار مع كل محاولة
            console.log(`Waiting ${retryDelay/1000} seconds before retry...`);
            
            // محاولة إعادة تحميل content script قبل إعادة المحاولة
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['js/content.js']
            }).then(() => {
              console.log("Content script reloaded, waiting before retry...");
              setTimeout(attemptPostMessage, retryDelay);
            }).catch(error => {
              console.error("Failed to reload content script:", error);
              setTimeout(attemptPostMessage, retryDelay);
            });
            return;
          }
          
          // لقد وصلنا للحد الأقصى من المحاولات
          handlePostingFailure(tab, group);
          return;
        }
        
        if (response && response.success) {
          console.log(`Posted successfully to: ${group.name}`);
          
          // زيادة عداد المنشورات المكتملة
          postState.postsCompleted++;
          
          // حفظ الحالة في التخزين المحلي
          savePostingState();
          
          // إغلاق علامة التبويب بعد النشر بنجاح
          setTimeout(() => {
            // حذف معرف علامة التبويب من حالة النشر
            delete postState.openTabs[group.url];
            
            // حفظ الحالة في التخزين المحلي
            savePostingState();
            
            // إغلاق علامة التبويب
            chrome.tabs.remove(tab.id).catch(error => {
              console.log("Error closing tab:", error);
            });
          }, 2000);
          
          // جدولة المنشور التالي مع التأخير
          scheduleNextPost();
        } else {
          console.error("Failed to post to group:", response ? response.message : "Unknown error");
          
          // إعادة المحاولة إذا لم نتجاوز الحد الأقصى للمحاولات
          if (retryCount < maxRetries) {
            retryCount++;
            console.log(`Retry attempt ${retryCount}/${maxRetries} for group: ${group.name}`);
            
            // زيادة وقت الانتظار بين المحاولات تدريجيًا
            const retryDelay = 5000 * retryCount; // زيادة وقت الانتظار مع كل محاولة
            console.log(`Waiting ${retryDelay/1000} seconds before retry...`);
            
            // الانتظار قبل إعادة المحاولة
            setTimeout(attemptPostMessage, retryDelay);
            return;
          }
          
          // لقد وصلنا للحد الأقصى من المحاولات
          handlePostingFailure(tab, group);
        }
      });
    } catch (error) {
      console.error("Exception in sendPostMessage:", error);
      
      // إعادة المحاولة إذا لم نتجاوز الحد الأقصى للمحاولات
      if (retryCount < maxRetries) {
        retryCount++;
        console.log(`Retry after exception ${retryCount}/${maxRetries} for group: ${group.name}`);
        
        // زيادة وقت الانتظار بين المحاولات تدريجيًا
        const retryDelay = 5000 * retryCount;
        setTimeout(attemptPostMessage, retryDelay);
        return;
      }
      
      // لقد وصلنا للحد الأقصى من المحاولات
      handlePostingFailure(tab, group);
    }
  }
  
  // بدء محاولة النشر الأولى
  attemptPostMessage();
}

/**
 * Handle posting failure
 */
function handlePostingFailure(tab, group) {
  console.log(`Posting to group ${group.name} failed, closing tab and continuing to next group...`);
  
  // إضافة المجموعة إلى قائمة المجموعات التي فشل النشر فيها
  if (!postState.failedGroups) {
    postState.failedGroups = [];
  }
  postState.failedGroups.push({
    group: group,
    time: Date.now(),
    reason: "لم يتم العثور على محرر النص للمنشور"
  });
  
  // إلغاء منع إغلاق علامة التبويب (حتى لا تظهر تحذيرات عند الإغلاق)
  try {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        if (typeof window.releaseTabClosingPrevention === 'function') {
          window.releaseTabClosingPrevention();
        }
      }
    }).catch(error => {
      console.log("Error releasing tab closing prevention:", error);
    });
  } catch (error) {
    console.log("Error executing tab closing prevention release:", error);
  }
  
  // إضافة تأخير قبل إغلاق علامة التبويب للسماح بإكمال أي عمليات معلقة
  setTimeout(() => {
    // حذف معرف علامة التبويب من حالة النشر
    delete postState.openTabs[group.url];
    
    // حفظ الحالة في التخزين المحلي
    savePostingState();
    
    // إغلاق علامة التبويب
    chrome.tabs.remove(tab.id).catch(error => {
      console.log("Error closing tab:", error);
    });
    
    // تحديث حالة النشر
    postState.statusMessage = `فشل النشر في مجموعة ${group.name}, الانتقال للمجموعة التالية...`;
    
    // احتساب عملية المحاولة كمنشور مكتمل (حتى لو فشلت)
    postState.postsCompleted++;
    
    // تحديث الواجهة إذا كانت مفتوحة
    chrome.runtime.sendMessage({
      action: "updatePostingStatus",
      status: {
        isPosting: postState.isPosting,
        postsCompleted: postState.postsCompleted,
        totalPosts: postState.totalPosts,
        remainingGroups: postState.remainingGroups.length,
        statusMessage: postState.statusMessage
      }
    }).catch(() => {}); // تجاهل أي خطأ إذا كانت الواجهة مغلقة
    
    // جدولة المنشور التالي مع تأخير أقل (لتسريع الانتقال للمجموعة التالية بعد الفشل)
    const nextPostDelay = getRandomDelay(5, 10) * 1000; // تأخير 5-10 ثواني فقط في حالة الفشل
    console.log(`Scheduling next post after failure in ${nextPostDelay/1000} seconds`);
    
    // تحديث وقت النشر التالي
    postState.nextPostTime = Date.now() + nextPostDelay;
    
    // حفظ الحالة المحدثة
    savePostingState();
    
    // جدولة النشر التالي
    setTimeout(postToNextGroup, nextPostDelay);
  }, 3000);
}

/**
 * Execute a function in a tab
 */
function executeInTab(tabId, functionToExecute, callback) {
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: functionToExecute
  }).then(callback).catch(error => {
    console.error("Failed to execute function in tab:", error);
  });
}

/**
 * Handle scheduling a post
 */
function handleSchedulePost(message, sendResponse) {
  const { content, groups, scheduleTime, isRandom, postingSettings, recurring } = message;
  
  if (!groups || groups.length === 0) {
    sendResponse({ success: false, message: "Please select groups to post to" });
    return;
  }
  
  if (!content || (Array.isArray(content) && content.length === 0)) {
    sendResponse({ success: false, message: "Please add post content" });
    return;
  }
  
  if (!scheduleTime) {
    sendResponse({ success: false, message: "Please select a valid schedule time" });
    return;
  }
  
  // Create scheduled post object
  const scheduledPost = {
    id: Date.now(),
    content: content,
    groups: groups,
    scheduleTime: scheduleTime,
    status: "pending",
    isRandom: isRandom === true,
    postingSettings: postingSettings || {
      intervalMin: 30,
      intervalMax: 60,
      enablePause: false,
      postsBeforePause: 5,
      pauseDuration: 15
    },
    recurring: recurring
  };
  
  // Add to scheduled posts array
  postState.scheduledPosts.push(scheduledPost);
  
  // Save to storage
  chrome.storage.local.set({ scheduledPosts: postState.scheduledPosts }, () => {
    console.log("Scheduled post saved successfully");
    
    // Set alarm for this post
    const alarmName = `scheduled-post-${scheduledPost.id}`;
    chrome.alarms.create(alarmName, { when: scheduleTime });
    
    sendResponse({ success: true, message: "Post scheduled successfully" });
  });
  
  return true; // Keep message channel open
}

/**
 * Get scheduled posts
 */
function getScheduledPosts(sendResponse) {
  // Read from local storage first, then use app state as backup
  chrome.storage.local.get(['scheduledPosts'], result => {
    if (result.scheduledPosts) {
      postState.scheduledPosts = result.scheduledPosts;
    }
    
    sendResponse({ success: true, scheduledPosts: postState.scheduledPosts });
  });
  
  return true; // Keep message channel open
}

/**
 * Delete a scheduled post
 */
function deleteScheduledPost(postId, sendResponse) {
  // Find post index
  const postIndex = postState.scheduledPosts.findIndex(post => post.id === postId);
  
  if (postIndex === -1) {
    sendResponse({ success: false, message: "Post not found" });
    return;
  }
  
  // Remove from array
  postState.scheduledPosts.splice(postIndex, 1);
    
  // Remove associated alarm
  chrome.alarms.clear(`scheduled-post-${postId}`);
      
  // Save to storage
  chrome.storage.local.set({ scheduledPosts: postState.scheduledPosts }, () => {
    sendResponse({ success: true, message: "Post deleted successfully" });
  });
  
  return true; // Keep message channel open
}

/**
 * Calculate random delay between posts
 */
function getRandomDelay(min, max) {
  // Ensure min and max are valid numbers
  min = typeof min === 'number' ? min : 30;
  max = typeof max === 'number' ? max : 60;
  
  // Force min and max to be at least 10 seconds
  min = Math.max(10, min);
  max = Math.max(min, max);
  
  // Calculate random delay
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Check scheduled posts on startup or periodically
 */
function checkScheduledPosts() {
  console.log("Checking scheduled posts...");
  
  // Load posts from storage
  chrome.storage.local.get(['scheduledPosts'], result => {
    if (result.scheduledPosts && result.scheduledPosts.length > 0) {
      postState.scheduledPosts = result.scheduledPosts;
      
      // Process posts that should have been posted already
      const now = Date.now();
      
      postState.scheduledPosts.forEach(post => {
        if (post.status === "pending" && post.scheduleTime <= now) {
          console.log(`Found pending post that should have run already: ${post.id}`);
          // Process this post
          processScheduledPost(post);
        }
      });
      
      // Set up alarms for pending posts
      postState.scheduledPosts.forEach(post => {
        if (post.status === "pending") {
          const alarmName = `scheduled-post-${post.id}`;
          chrome.alarms.create(alarmName, { when: post.scheduleTime });
      }
    });
  }
});

  // Check again in 5 minutes
  setTimeout(checkScheduledPosts, 5 * 60 * 1000);
}

/**
 * Process a scheduled post
 */
function processScheduledPost(scheduledPost) {
  console.log(`Processing scheduled post: ${scheduledPost.id}`);
  
  // Update post status
  scheduledPost.status = "processing";
  
  // Update in storage
  updateScheduledPostInStorage(scheduledPost);
  
  // Set up posting state
  postState.isPosting = true;
  postState.postsCompleted = 0;
  postState.totalPosts = scheduledPost.groups.length;
  postState.remainingGroups = [...scheduledPost.groups];
  postState.useRandomSelection = scheduledPost.isRandom === true;
  postState.isPaused = false;
  
  // Save posting settings if provided
  if (scheduledPost.postingSettings) {
    postState.postingSettings = {
      intervalMin: scheduledPost.postingSettings.intervalMin || 30,
      intervalMax: scheduledPost.postingSettings.intervalMax || 60,
      enablePause: scheduledPost.postingSettings.enablePause || false,
      postsBeforePause: scheduledPost.postingSettings.postsBeforePause || 5,
      pauseDuration: scheduledPost.postingSettings.pauseDuration || 15
    };
  } else {
    // Default settings
    postState.postingSettings = {
      intervalMin: 30,
      intervalMax: 60,
      enablePause: false,
      postsBeforePause: 5,
      pauseDuration: 15
    };
  }
  
  // Set content based on whether it's a single post or multiple
  if (Array.isArray(scheduledPost.content)) {
    postState.multiplePosts = scheduledPost.content;
    console.log(`Processing ${scheduledPost.content.length} posts, random selection: ${postState.useRandomSelection ? 'enabled' : 'disabled'}`);
  } else {
    postState.multiplePosts = [scheduledPost.content];
  }
  
  // Begin posting process
  postState.statusMessage = `Processing scheduled post #${scheduledPost.id}`;
  scheduleNextPost();
  
  // If post is recurring, schedule the next occurrence
  if (scheduledPost.recurring && 
      scheduledPost.recurring.count > scheduledPost.recurring.currentCount) {
    
    // Increment the current count
    scheduledPost.recurring.currentCount++;
    
    // Calculate the next schedule time
    const nextScheduleTime = calculateNextScheduleTime(
      scheduledPost.scheduleTime,
      scheduledPost.recurring.type
    );
    
    // Create a new scheduled post for the next occurrence
    const nextPost = { ...scheduledPost };
    nextPost.id = Date.now(); // New ID
    nextPost.scheduleTime = nextScheduleTime;
    nextPost.status = "pending";
    
    // Add to scheduled posts array
    postState.scheduledPosts.push(nextPost);
    
    // Save to storage
    updateScheduledPostInStorage(nextPost);
    
    // Set alarm for this post
    const alarmName = `scheduled-post-${nextPost.id}`;
    chrome.alarms.create(alarmName, { when: nextScheduleTime });
  }
}

/**
 * Calculate the next schedule time based on recurrence type
 */
function calculateNextScheduleTime(currentTime, recurringType) {
  const date = new Date(currentTime);
  
  switch (recurringType) {
    case "daily":
      date.setDate(date.getDate() + 1);
      break;
    case "weekly":
      date.setDate(date.getDate() + 7);
      break;
    case "monthly":
      // Handle month with different lengths
      const currentMonth = date.getMonth();
      date.setMonth(currentMonth + 1);
      
      // If the day doesn't exist in the next month (e.g., Jan 31 -> Feb 31)
      // Set to the last day of the month
      const newMonth = date.getMonth();
      if (newMonth !== (currentMonth + 1) % 12) {
        date.setDate(0); // Set to the last day of the previous month
      }
      break;
    default:
      date.setDate(date.getDate() + 1); // Default to daily
  }
  
  return date.getTime();
}

/**
 * Helper function to update a scheduled post in storage
 */
function updateScheduledPostInStorage(updatedPost) {
  // Update in the array
  const postIndex = postState.scheduledPosts.findIndex(p => p.id === updatedPost.id);
  
  if (postIndex !== -1) {
    postState.scheduledPosts[postIndex] = updatedPost;
  }
  
  // Save to storage
  chrome.storage.local.set({ scheduledPosts: postState.scheduledPosts });
}

/**
 * Get a scheduled post by ID
 */
function getScheduledPostById(postId, sendResponse) {
  chrome.storage.local.get(['scheduledPosts'], result => {
    if (result.scheduledPosts) {
      postState.scheduledPosts = result.scheduledPosts;
    }
    
    const post = postState.scheduledPosts.find(p => p.id === postId);
    
    if (post) {
      sendResponse({ success: true, post: post });
    } else {
      sendResponse({ success: false, message: "Post not found" });
    }
  });
  
  return true; // Keep message channel open
}

/**
 * Update a scheduled post
 */
function updateScheduledPost(postId, updatedData, sendResponse) {
  // Find post
  const postIndex = postState.scheduledPosts.findIndex(post => post.id === postId);
  
  if (postIndex === -1) {
    sendResponse({ success: false, message: "Post not found" });
    return true;
  }
  
  const post = postState.scheduledPosts[postIndex];
  
  // Update fields
  if (updatedData.content) {
    post.content = updatedData.content;
  }
  
  if (updatedData.groups) {
    post.groups = updatedData.groups;
  }
  
  if (updatedData.scheduleTime) {
    post.scheduleTime = updatedData.scheduleTime;
    
    // Update alarm
    const alarmName = `scheduled-post-${post.id}`;
    chrome.alarms.clear(alarmName);
    chrome.alarms.create(alarmName, { when: post.scheduleTime });
  }
  
  if (updatedData.isRandom !== undefined) {
    post.isRandom = updatedData.isRandom;
  }
  
  if (updatedData.postingSettings) {
    post.postingSettings = updatedData.postingSettings;
  }
  
  if (updatedData.recurring) {
    post.recurring = updatedData.recurring;
  }
  
  // Update in storage
  chrome.storage.local.set({ scheduledPosts: postState.scheduledPosts }, () => {
    sendResponse({ success: true, message: "Post updated successfully" });
  });
  
  return true; // Keep message channel open
}

// Listen for alarm events to trigger scheduled posts
chrome.alarms.onAlarm.addListener((alarm) => {
  // Check if this is a scheduled post alarm
  if (alarm.name.startsWith('scheduled-post-')) {
    const postId = parseInt(alarm.name.replace('scheduled-post-', ''));
    
    // Find the post
    const post = postState.scheduledPosts.find(p => p.id === postId);
    
    if (post && post.status === "pending") {
      console.log(`Alarm triggered for scheduled post: ${postId}`);
      processScheduledPost(post);
    }
  }
});

// إضافة مستمع لحدث إغلاق علامات التبويب
chrome.tabs.onRemoved.addListener((tabId) => {
  // البحث عن علامة التبويب في حالة النشر
  for (const [groupUrl, savedTabId] of Object.entries(postState.openTabs)) {
    if (savedTabId === tabId) {
      console.log(`Tab for group ${groupUrl} (ID: ${tabId}) was closed`);
      delete postState.openTabs[groupUrl];
      savePostingState();
      break;
    }
  }
});

// إضافة مستمع لحدث إعادة تحميل علامات التبويب
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  // إذا تم إعادة تحميل علامة التبويب
  if (changeInfo.status === 'loading') {
    // البحث عن علامة التبويب في حالة النشر
    for (const [groupUrl, savedTabId] of Object.entries(postState.openTabs)) {
      if (savedTabId === tabId) {
        console.log(`Tab for group ${groupUrl} (ID: ${tabId}) is reloading`);
        // لا نحذف علامة التبويب من الحالة لأنها ستظل موجودة بعد إعادة التحميل
        break;
      }
    }
  }
});

// إضافة مستمع لحدث إغلاق المتصفح
chrome.runtime.onSuspend.addListener(() => {
  console.log("Browser is about to close, saving state");
  savePostingState();
});

// إضافة مستمع لحدث إعادة تشغيل المتصفح
chrome.runtime.onStartup.addListener(() => {
  console.log("Browser has started, restoring state");
  restorePostingState();
});

// إضافة مستمع لحدث تثبيت أو تحديث الإضافة
chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed or updated, restoring state");
  restorePostingState();
  
  // Initialize scheduled posts if not exists
  chrome.storage.local.get(['scheduledPosts'], result => {
    if (!result.scheduledPosts) {
      chrome.storage.local.set({ scheduledPosts: [] });
    }
  });
});

// Check scheduled posts when service worker starts
checkScheduledPosts();
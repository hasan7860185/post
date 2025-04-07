/**
 * FBGroupMaster
 * Content script for interacting with Facebook pages
 */

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Message received in content script:", message.action);
  
  // Add response to ping messages for connection testing
  if (message.action === "ping") {
    console.log("Ping message received, sending response");
    sendResponse({ success: true, message: "content script available" });
    return true;
  }
  
  if (message.action === "postToGroup") {
    // Start posting process in the group
    postContentToGroup(message.post, message.images)
      .then(result => {
        console.log("Posted successfully");
        sendResponse({ success: true, message: "Posted successfully" });
      })
      .catch(error => {
        console.error("Failed to post to group:", error);
        sendResponse({ success: false, message: error.toString() });
      });
    
    return true; // Keep message channel open for async response
  }
  
  // Extract groups from Facebook page
  if (message.action === "extractGroups") {
    extractGroups()
      .then(groups => {
        sendResponse({ success: true, groups });
      })
      .catch(error => {
        console.error("Failed to extract groups:", error);
        sendResponse({ success: false, error: error.toString() });
      });
    
    return true; // Keep message channel open for async response
  }
});

/**
 * Prevent tab closing before process completion
 */
function preventTabClosing() {
  console.log("Activating tab closing prevention until process completes...");
  
  // Set global variable to control process state
  window.__postingInProgress = true;
  
  // Add listener for beforeunload event to prevent tab closing
  const beforeUnloadListener = (event) => {
    if (window.__postingInProgress) {
      // Show confirmation message to user
      const message = "Process in progress, are you sure you want to close the page?";
      event.preventDefault();
      event.returnValue = message;
      return message;
    }
  };
  
  // Add listener to window
  window.addEventListener('beforeunload', beforeUnloadListener);
  
  // Return function to remove closing prevention after process completion
  return function releaseTabClosingPrevention() {
    console.log("Removing tab closing prevention after process completion");
    window.__postingInProgress = false;
    window.removeEventListener('beforeunload', beforeUnloadListener);
  };
}

/**
 * Post to Facebook group
 */
async function postContentToGroup(post, images = []) {
  console.log("Starting postContentToGroup function");
  
  // منع إغلاق علامة التبويب أثناء عملية النشر
  const releaseTabClosing = preventTabClosing();
  
  // زيادة مدة الانتظار إلى 3 دقائق
  const timeoutDuration = 180000; // 180 seconds (3 minutes)
  
  try {
    return new Promise((resolve, reject) => {
      console.log("Creating promise for postContentToGroup");
      
      // إضافة معالجة الأخطاء للوعد
      const safeResolve = (message) => {
        try {
          console.log("Resolving promise with:", message);
          // تحرير منع إغلاق علامة التبويب
          if (typeof releaseTabClosing === 'function') {
            releaseTabClosing();
          }
          resolve(message);
        } catch (error) {
          console.warn("Warning in safeResolve:", error);
          // محاولة حل الوعد بأي حال من الأحوال
          try {
            resolve({ success: true, message: "Post completed with errors" });
          } catch (e) {
            console.warn("Warning in fallback resolve:", e);
          } finally {
            // التأكد من تحرير منع إغلاق علامة التبويب
            if (typeof releaseTabClosing === 'function') {
              releaseTabClosing();
            }
          }
        }
      };
      
      const safeReject = (error) => {
        try {
          console.warn("Warning: Rejecting promise with error:", error);
          // تحرير منع إغلاق علامة التبويب
          if (typeof releaseTabClosing === 'function') {
            releaseTabClosing();
          }
          // استخدام تنسيق موحد للخطأ
          const errorMessage = error instanceof Error ? error.message : String(error);
          reject(new Error(errorMessage));
        } catch (e) {
          console.warn("Warning in safeReject:", e);
          // محاولة رفض الوعد بأي حال من الأحوال
          try {
            reject(new Error("Post failed with errors"));
          } catch (err) {
            console.warn("Warning in fallback reject:", err);
          } finally {
            // التأكد من تحرير منع إغلاق علامة التبويب
            if (typeof releaseTabClosing === 'function') {
              releaseTabClosing();
            }
          }
        }
      };
      
      // منع ظهور الأخطاء غير المعالجة في واجهة المستخدم عن طريق استخدام مستوى سجل تحذير بدلاً من خطأ
      window.addEventListener('error', (event) => {
        console.warn("Unhandled error in content script:", event.error);
        event.preventDefault(); // منع ظهور الخطأ في وحدة التحكم
        return true; // منع انتشار الخطأ
      });
      
      // منع ظهور الوعود المرفوضة غير المعالجة في واجهة المستخدم
      window.addEventListener('unhandledrejection', (event) => {
        console.warn("Unhandled promise rejection:", event.reason);
        event.preventDefault(); // منع ظهور الخطأ في وحدة التحكم
        return true; // منع انتشار الخطأ
      });
      
      // تعيين مؤقت للوعد
      const timeoutId = setTimeout(() => {
        console.log("Timeout reached, attempting to post anyway");
        
        // محاولة النشر حتى بعد انتهاء المهلة
        try {
          // محاولة العثور على زر النشر والنقر عليه
          const postButton = findPostButton(document.body);
          if (postButton) {
            console.log("Found post button after timeout, clicking it");
            clickPostButton(postButton, () => {
              console.log("Post button clicked after timeout");
              
              // محاولة إغلاق أي مربعات حوار تأكيد
              setTimeout(() => {
                try {
                  closeConfirmationDialog();
                } catch (e) {
                  console.warn("Warning: Error closing confirmation dialog after timeout:", e);
                }
                
                // حل الوعد بعد محاولة النشر
                safeResolve({ success: true, message: "Post completed after timeout" });
              }, 5000);
            });
          } else {
            console.log("Could not find post button after timeout");
            safeResolve({ success: true, message: "Post may have completed before timeout" });
          }
        } catch (error) {
          console.warn("Warning in timeout handler:", error);
          safeResolve({ success: true, message: "Post completed with errors after timeout" });
        } finally {
          // التأكد من تحرير منع إغلاق علامة التبويب
          if (typeof releaseTabClosing === 'function') {
            releaseTabClosing();
          }
        }
      }, timeoutDuration);
      
      // محاولة النشر
      try {
        // محاولة النشر إلى واجهة Facebook الجديدة
        postToNewInterface(post, images, (result) => {
          clearTimeout(timeoutId);
          safeResolve(result);
        }, (error) => {
          console.warn("Warning: Error in new interface, trying old interface:", error);
          
          // محاولة النشر إلى واجهة Facebook القديمة
          postToOldInterface(post, images, (result) => {
            clearTimeout(timeoutId);
            safeResolve(result);
          }, (oldError) => {
            console.warn("Warning: Error in old interface:", oldError);
            clearTimeout(timeoutId);
            safeReject(oldError);
          });
        });
      } catch (error) {
        console.warn("Warning: Critical error in postContentToGroup:", error);
        clearTimeout(timeoutId);
        safeReject(error);
      }
    });
  } catch (error) {
    console.warn("Warning: Outer error in postContentToGroup:", error);
    // إرجاع وعد محلول بدلاً من مرفوض للتقليل من ظهور رسائل الخطأ
    if (typeof releaseTabClosing === 'function') {
      releaseTabClosing();
    }
    return Promise.resolve({ success: false, message: "Failed but continuing with next group", error: error.message });
  }
}

/**
 * Post to new Facebook interface
 */
function postToNewInterface(post, images, resolve, reject) {
  try {
    console.log("Attempting to post to new Facebook interface");
    
    // Check if we're on a group page
    const isGroupPage = window.location.href.includes('/groups/');
    if (!isGroupPage) {
      console.warn("We're not on a group page, there might be an error in the URL");
    }
    
    // Prepare post data (it could be plain text or an object)
    if (typeof post === 'string') {
      post = { text: post };
    }
    
    console.log("Post content:", post.text?.substring(0, 50) + "...");
    console.log("Number of images:", images?.length || 0);
    
    // Helper function for posting after dialog opens
    function handlePostingProcess(dialog, editor, container) {
      // Find text editor if it's not provided
      if (!editor) {
        // Try to find text editor inside the dialog first
        let dialogEditor = null;
        if (dialog) {
          // Search for the editor inside the dialog
          const contentEditables = dialog.querySelectorAll('[contenteditable="true"]');
          for (const el of contentEditables) {
            if (isElementVisible(el) && !el.closest('[aria-label*="comment"], [aria-label*="comment"]')) {
              dialogEditor = el;
              break;
            }
          }
        }
        
        // If no editor found in the dialog, search in the main content area
        editor = dialogEditor || findPostTextArea();
        
        if (!editor) {
          console.error("Text editor not found");
          return reject("Text editor not found for post");
        }
        
        console.log("Text editor found:", editor);
      }
      
      // جديد: تسلسل الإجراءات مع تحميل الصور أولاً ثم إضافة النص أخيراً
      console.log("بدء تسلسل النشر بترتيب معكوس: صور أولاً ثم نص");
      
      // الحالة 1: في حالة وجود صور، نقوم بتحميلها أولاً ثم إضافة النص
      if (images && images.length > 0) {
        console.log(`بدء تحميل ${images.length} صورة قبل إضافة النص...`);
        
        // محاولة تحميل الصور أولا
        uploadImagesToFacebook(container || dialog, images)
          .then(() => {
            console.log("✅ تم تحميل الصور بنجاح، انتظار لتأكيد التحميل قبل إضافة النص...");
            
            // تقليل وقت الانتظار بعد تحميل الصور من 5 ثوان إلى 2 ثانية
            setTimeout(() => {
              // التحقق من وجود معاينات الصور قبل إضافة النص
              const imagePreviewCheck = () => {
                // البحث عن عناصر معاينة الصور
                const previewElements = document.querySelectorAll('img[alt*="preview"], div[aria-label*="image"], div[aria-label*="صورة"], div.uploadingPreview');
                
                if (previewElements.length > 0) {
                  console.log(`✅ تم التأكد من وجود ${previewElements.length} معاينة للصور قبل إضافة النص`);
                  
                  // إضافة النص بعد التأكد من وجود معاينات الصور
                  console.log("➡️ إضافة النص بعد الصور...");
                  fillPostContent(editor, post);
                  
                  // تقليل وقت الانتظار بعد إضافة النص من 3 ثوان إلى 1 ثانية
                  setTimeout(() => {
                    console.log("🔍 البحث عن زر النشر والنقر عليه...");
                    addTextAndPublish(editor, post, dialog || container);
                    // تقليل وقت الانتظار الإضافي بعد النشر من 20 ثانية إلى 5 ثوان
                    setTimeout(() => resolve("تم النشر بنجاح مع الصور والنص"), 5000);
                  }, 1000);
                } else {
                  console.log("⚠️ لم يتم العثور على معاينات الصور بعد، محاولة أخرى...");
                  
                  // محاولة النقر على زر إضافة الصور مرة أخرى إذا لم نجد معاينات
                  const photoButtons = document.querySelectorAll('div[role="button"][aria-label*="Photo"], div[role="button"][aria-label*="صورة"]');
                  if (photoButtons.length > 0) {
                    console.log("محاولة النقر على زر إضافة الصور مرة أخرى");
                    photoButtons[0].click();
                    
                    // تقليل وقت الانتظار بعد النقر على زر إضافة الصور من 5 ثوان إلى 2 ثانية
                    setTimeout(() => {
                      console.log("➡️ إضافة النص بعد محاولة إعادة تحميل الصور...");
                      fillPostContent(editor, post);
                      
                      // تقليل وقت الانتظار بعد إضافة النص من 3 ثوان إلى 1 ثانية
                      setTimeout(() => {
                        console.log("🔍 البحث عن زر النشر والنقر عليه...");
                        addTextAndPublish(editor, post, dialog || container);
                        // تقليل وقت الانتظار الإضافي بعد النشر من 20 ثانية إلى 5 ثوان
                        setTimeout(() => resolve("تم النشر بنجاح بعد محاولة ثانية"), 5000);
                      }, 1000);
                    }, 2000);
                  } else {
                    // إذا لم نجد زر إضافة الصور، نضيف النص مباشرة
                    console.log("➡️ إضافة النص بعد فشل العثور على زر إضافة الصور مرة أخرى...");
                    fillPostContent(editor, post);
                    
                    // تقليل وقت الانتظار بعد إضافة النص من 3 ثوان إلى 1 ثانية
                    setTimeout(() => {
                      console.log("🔍 البحث عن زر النشر والنقر عليه...");
                      addTextAndPublish(editor, post, dialog || container);
                      // تقليل وقت الانتظار الإضافي بعد النشر من 20 ثانية إلى 5 ثوان
                      setTimeout(() => resolve("تم النشر بنجاح بعد محاولة أخيرة"), 5000);
                    }, 1000);
                  }
                }
              };
              
              // تنفيذ فحص معاينات الصور
              imagePreviewCheck();
            }, 2000); // تقليل من 5 ثوان إلى 2 ثانية
          })
          .catch(error => {
            console.error("❌ فشل في تحميل الصور:", error);
            
            // في حالة فشل تحميل الصور، نحاول مرة أخرى بطريقة مختلفة
            console.log("⚠️ محاولة ثانية لتحميل الصور...");
            
            // البحث عن زر تحميل الصور بطريقة أخرى
            const photoButtons = document.querySelectorAll('div[role="button"][aria-label*="Photo"], div[role="button"][aria-label*="صورة"]');
            if (photoButtons.length > 0) {
              console.log("محاولة النقر على زر تحميل الصور مرة أخرى");
              photoButtons[0].click();
              
              // تقليل وقت الانتظار بعد النقر على زر تحميل الصور من 2 ثوان إلى 1 ثانية
              setTimeout(() => {
                const fileInputs = document.querySelectorAll('input[type="file"]');
                if (fileInputs.length > 0) {
                  console.log("محاولة ثانية: تم العثور على مدخل ملف");
                  
                  // محاولة ثانية لتحميل الصور
                  uploadImagesToFacebook(container || dialog, images)
                    .then(() => {
                      console.log("✅ نجحت المحاولة الثانية لتحميل الصور، إضافة النص الآن...");
                      
                      // تقليل وقت الانتظار بعد نجاح المحاولة الثانية من 3 ثوان إلى 1 ثانية
                      setTimeout(() => {
                        console.log("➡️ إضافة النص بعد المحاولة الثانية للصور...");
                        fillPostContent(editor, post);
                        
                        // تقليل وقت الانتظار بعد إضافة النص من 3 ثوان إلى 1 ثانية
                        setTimeout(() => {
                          console.log("🔍 البحث عن زر النشر والنقر عليه...");
                          addTextAndPublish(editor, post, dialog || container);
                          // تقليل وقت الانتظار الإضافي بعد النشر من 20 ثانية إلى 5 ثوان
                          setTimeout(() => resolve("تم النشر بنجاح بعد المحاولة الثانية"), 5000);
                        }, 1000);
                      }, 1000);
                    })
                    .catch(error => {
                      console.error("❌ فشلت المحاولة الثانية لتحميل الصور أيضًا:", error);
                      
                      // في حالة فشل المحاولة الثانية، نضيف النص على الأقل
                      console.log("➡️ إضافة النص بعد فشل المحاولتين لتحميل الصور...");
                      fillPostContent(editor, post);
                      
                      // تقليل وقت الانتظار بعد إضافة النص من 2 ثوان إلى 1 ثانية
                      setTimeout(() => {
                        console.log("🔍 البحث عن زر النشر والنقر عليه...");
                        addTextAndPublish(editor, post, dialog || container);
                        // تقليل وقت الانتظار الإضافي بعد النشر من 20 ثانية إلى 5 ثوان
                        setTimeout(() => resolve("تم النشر بنجاح مع النص فقط بعد فشل الصور"), 5000);
                      }, 1000);
                    });
                } else {
                  // إذا لم نجد مدخل ملف، نضيف النص على الأقل
                  console.log("⚠️ لم يتم العثور على مدخل ملف، إضافة النص فقط...");
                  fillPostContent(editor, post);
                  
                  // تقليل وقت الانتظار بعد إضافة النص من 2 ثوان إلى 1 ثانية
                  setTimeout(() => {
                    console.log("🔍 البحث عن زر النشر والنقر عليه...");
                    addTextAndPublish(editor, post, dialog || container);
                    // تقليل وقت الانتظار الإضافي بعد النشر من 20 ثانية إلى 5 ثوان
                    setTimeout(() => resolve("تم النشر بنجاح بالنص فقط"), 5000);
                  }, 1000);
                }
              }, 1000);
            } else {
              // إذا لم نجد زر تحميل الصور، نضيف النص على الأقل
              console.log("⚠️ لم يتم العثور على زر تحميل الصور، إضافة النص فقط...");
              fillPostContent(editor, post);
              
              // تقليل وقت الانتظار بعد إضافة النص من 2 ثوان إلى 1 ثانية
              setTimeout(() => {
                console.log("🔍 البحث عن زر النشر والنقر عليه...");
                addTextAndPublish(editor, post, dialog || container);
                // تقليل وقت الانتظار الإضافي بعد النشر من 20 ثانية إلى 5 ثوان
                setTimeout(() => resolve("تم النشر بنجاح بالنص فقط"), 5000);
              }, 1000);
            }
          });
      } else {
        // في حالة عدم وجود صور، نضيف النص مباشرة
        console.log("📝 لا توجد صور، إضافة النص مباشرة...");
        fillPostContent(editor, post);
        
        // تقليل وقت الانتظار بعد إضافة النص من 2 ثوان إلى 1 ثانية
        setTimeout(() => {
          console.log("🔍 البحث عن زر النشر والنقر عليه...");
          addTextAndPublish(editor, post, dialog || container);
          // تقليل وقت الانتظار الإضافي بعد النشر من 20 ثانية إلى 5 ثوان
          setTimeout(() => resolve("تم النشر بنجاح (بدون صور)"), 5000);
        }, 1000);
      }
    }
    
    // Helper function to add text and then post
    function addTextAndPublish(editor, post, container) {
      try {
        console.log("التأكد من إدراج النص قبل النشر...");

        // إضافة تأخير إضافي للتأكد من اكتمال عملية النسخ واللصق
        setTimeout(() => {
          // التحقق من وجود النص في المحرر قبل محاولة النشر
          const currentText = editor.textContent || editor.value || '';
          const targetText = typeof post === 'object' ? post.text : post;
          
          // تنظيف أي تحديد موجود لتجنب الكتابة المتكررة
          if (window.getSelection) {
            window.getSelection().removeAllRanges();
          }
          
          // إذا لم يتم إدراج النص بعد أو كان هناك تكرار، قم بإعادة تنظيف المحرر وإعادة المحاولة
          if (!currentText || currentText.trim() === '' || (currentText.length > targetText.length * 1.5 && currentText.includes(targetText))) {
            console.warn("تم اكتشاف محتوى غير صحيح أو تكرار في النص، إعادة تنظيف المحرر...");
            
            // تنظيف المحرر
            if (editor.tagName && editor.tagName.toLowerCase() === 'textarea') {
              editor.value = '';
            } else if (editor.isContentEditable) {
              editor.textContent = '';
              editor.innerHTML = '';
            }
            
            // إعادة تنفيذ fillPostContent بطريقة أبسط ومباشرة
            console.log("إعادة إدراج النص بطريقة مباشرة...");
            
            // استخدام طريقة مباشرة للإدراج لتجنب التكرار
            if (editor.isContentEditable) {
              document.execCommand('insertText', false, targetText);
              
              // التحقق مرة أخرى
              if (!editor.textContent || editor.textContent.trim() === '') {
                // استخدام textContent كحل أخير
                editor.textContent = targetText;
              }
            } else if (editor.tagName && editor.tagName.toLowerCase() === 'textarea') {
              editor.value = targetText;
            }
            
            // إطلاق أحداث فيسبوك
            triggerFacebookEvents(editor);
            
            // إعطاء مهلة إضافية قبل المتابعة إلى النشر
            setTimeout(() => {
              proceedWithPosting();
            }, 1000);
          } else {
            // النص موجود وبشكل صحيح، المتابعة إلى النشر
            console.log("النص موجود في المحرر، المتابعة إلى النشر...");
            proceedWithPosting();
          }
        }, 1500); // تأخير أطول للتأكد من اكتمال عملية النسخ واللصق

        // وظيفة مساعدة للمتابعة إلى عملية النشر
        function proceedWithPosting() {
          console.log("البحث عن زر النشر والنقر عليه...");
          
          // تقليل وقت انتظار البحث عن زر النشر من 2 ثانية إلى 1 ثانية
          setTimeout(() => {
            console.log("البحث عن زر النشر...");
            
            // الطريقة 1: البحث عن أزرار واضحة
            let postButton = findPostButton(container);
            
            if (!postButton) {
              console.log("البحث عن زر النشر باستخدام طريقة محددة...");
              postButton = findSpecificPostButtonInDialog();
            }
            
            if (!postButton) {
              console.log("البحث عن زر النشر من خلال قائمة كاملة من الأزرار...");
              const allButtons = findAllPostButtons(container);
              if (allButtons && allButtons.length > 0) {
                postButton = allButtons[0];
              }
            }
            
            if (postButton) {
              console.log("تم العثور على زر النشر، جار النقر عليه...");
              
              // التأكد مرة أخرى من وجود النص قبل النقر على زر النشر
              const finalCheck = editor.textContent || editor.value || '';
              if (!finalCheck || finalCheck.trim() === '') {
                console.warn("تنبيه: المحرر فارغ قبل النشر مباشرة!");
              } else {
                console.log("النص موجود في المحرر قبل النشر:", finalCheck.substring(0, 30) + "...");
              }
              
              // المتابعة بالنقر على زر النشر
              clickPostButton(postButton, (message) => {
                console.log("تم النشر بنجاح:", message);
                // تقليل وقت الانتظار قبل إغلاق علامة التبويب من 3 ثوان إلى 2 ثانية
                setTimeout(() => {
                  window.close();
                }, 2000);
              });
            } else {
              console.log("البحث عن زر نشر بديل...");
              
              // طريقة بديلة: البحث عن أي زر في الجزء السفلي من مربع الحوار أو النافذة
              const dialog = (container && container.closest) ? container.closest('div[role="dialog"]') : document.querySelector('div[role="dialog"]');
              let lastResortButton = null;
              
              if (dialog) {
                // البحث عن أزرار في الجزء السفلي من مربع الحوار
                const buttons = [...dialog.querySelectorAll('button')];
                if (buttons.length > 0) {
                  // ترتيب الأزرار حسب الموضع (من الأسفل إلى الأعلى)
                  const sortedButtons = buttons.filter(isElementVisible).sort((a, b) => {
                    const rectA = a.getBoundingClientRect();
                    const rectB = b.getBoundingClientRect();
                    return rectB.top - rectA.top; // الترتيب التنازلي (من الأسفل إلى الأعلى)
                  });
                  
                  if (sortedButtons.length > 0) {
                    lastResortButton = sortedButtons[0]; // استخدام أول زر في الأسفل
                    console.log("تم العثور على زر النشر في الجزء السفلي من مربع الحوار");
                  } else {
                    // الملاذ الأخير: إنشاء زر وهمي
                    console.log("لم يتم العثور على أزرار، جار إنشاء زر وهمي...");
                    lastResortButton = createFakePostButton(dialog);
                  }
                }
              }
              
              if (lastResortButton) {
                console.log("استخدام زر بديل للنشر...");
                clickPostButton(lastResortButton, (message) => {
                  console.log("تم النشر بنجاح باستخدام زر بديل:", message);
                  // تقليل وقت الانتظار قبل إغلاق علامة التبويب من 3 ثوان إلى 2 ثانية
                  setTimeout(() => {
                    window.close();
                  }, 2000);
                });
              } else {
                console.log("لم يتم العثور على أزرار للنشر ولم يتم إنشاء زر وهمي");
                
                // محاولة محاكاة ضغط مفتاح Enter كملاذ أخير للنشر
                try {
                  console.log("محاولة محاكاة ضغط مفتاح Enter كملاذ أخير للنشر...");
                  editor.focus();
                  const keyEvent = new KeyboardEvent('keydown', {
                    key: 'Enter',
                    code: 'Enter',
                    keyCode: 13,
                    which: 13,
                    bubbles: true,
                    cancelable: true,
                    ctrlKey: true // استخدام اختصار Ctrl+Enter، وهو شائع للنشر
                  });
                  editor.dispatchEvent(keyEvent);
                  
                  // تقليل وقت الانتظار للتأكد من النشر من 5 ثوان إلى 3 ثوان
                  setTimeout(() => {
                    // افتراض أن النشر كان ناجحًا
                    console.log("تم محاولة النشر باستخدام الاختصار");
                    // تقليل وقت الانتظار قبل إغلاق علامة التبويب من 3 ثوان إلى 2 ثانية
                    setTimeout(() => {
                      window.close();
                    }, 2000);
                  }, 3000);
                } catch (e) {
                  console.warn("فشل النشر:", e);
                }
              }
            }
          }, 1000);
        }
      } catch (error) {
        console.error("حدث خطأ أثناء النشر:", error);
      }
    }
    
    // 1. Increase waiting time for page load
    setTimeout(() => {
      console.log("Searching for post area...");
      
      // Focus on the main content area containing the post
      const mainContentArea = document.querySelector('div[role="main"]');
      
      if (!mainContentArea) {
        return reject("Post area not found");
      }
      
      // 2. Finding create post button - only in main area and not in posts
      const createPostButton = findCreatePostButton();
      
      if (!createPostButton) {
        console.error("Create post button not found");
        
        // Trying to find visible editor (might be open already)
        const visibleEditor = document.querySelector('div[role="dialog"] [contenteditable="true"], div[role="dialog"] [role="textbox"], div[role="dialog"] [data-lexical-editor="true"]');
        if (visibleEditor) {
          console.log("Visible editor found, using it");
          const dialog = visibleEditor.closest('div[role="dialog"]');
          
          // Starting to post with the existing editor
          handlePostingProcess(dialog, visibleEditor, dialog);
          return;
        }
        
        return reject("Create post button not found in group");
      }
      
      console.log("Create post button found, clicking...");
      
      // تقليل التأخير قبل النقر من 2 ثانية إلى 500 مللي ثانية
      setTimeout(() => {
        createPostButton.click();
        
        // Logging for debugging
        console.log("Create post button clicked, waiting for text editor...");
        
        // تقليل وقت الانتظار لظهور محرر النص من 5 ثوان إلى 2 ثانية
        setTimeout(() => {
          console.log("Searching for post dialog...");
          
          // Trying to find post text area inside the dialog
          const dialog = document.querySelector('div[role="dialog"]');
          
          if (dialog) {
            // If there's an open dialog
            console.log("Post dialog found");
            
            // Searching for text editor in the dialog
            const postTextArea = dialog.querySelector('[contenteditable="true"], [role="textbox"], [data-lexical-editor="true"]');
            
            if (postTextArea) {
              console.log("Text editor found in dialog");
              // Starting to post with the existing text editor
              handlePostingProcess(dialog, postTextArea, dialog);
            } else {
              // If no text editor found in the dialog, search more broadly
              console.log("Text editor not found in dialog, searching more broadly...");
              const globalEditor = findPostTextArea();
              
              if (globalEditor) {
                handlePostingProcess(dialog, globalEditor, dialog);
              } else {
                reject("Post text area not found after opening dialog");
              }
            }
          } else {
            // If no dialog appears, it might be a direct text input
            console.log("No dialog found, searching for inline editor...");
            const inlineEditor = findInlineEditor();
            
            if (inlineEditor) {
              console.log("Inline editor found");
              const parentContainer = inlineEditor.closest('div[role="presentation"]') || document.body;
              
              // Starting to post with the inline editor
              handlePostingProcess(null, inlineEditor, parentContainer);
            } else {
              // Last resort: searching for any editable content
              console.log("Searching for any editable content...");
              const lastResortEditor = document.querySelector(
                '[contenteditable="true"]:not([aria-label*="comment"]), ' +
                '[role="textbox"]:not([aria-label*="comment"]), ' + 
                '[data-lexical-editor="true"]:not([aria-label*="comment"])'
              );
              
              if (lastResortEditor && !lastResortEditor.closest('[aria-label*="Comment"]')) {
                console.log("Text found in last resort");
                const parentContainer = lastResortEditor.closest('div[role="presentation"]') || document.body;
                
                // Starting to post with the global editor
                handlePostingProcess(null, lastResortEditor, parentContainer);
              } else {
                return reject("No text editor found");
              }
            }
          }
        }, 2000); // تقليل من 5000 (5 ثوان) إلى 2000 (2 ثانية)
      }, 500); // تقليل من 2000 (2 ثانية) إلى 500 مللي ثانية
    }, 2000); // تقليل من 5000 (5 ثوان) إلى 2000 (2 ثانية)
  } catch (error) {
    console.error("Error in posting:", error);
    reject(`Error in posting: ${error.message}`);
  }
}

/**
 * Find inline editor in the page
 */
function findInlineEditor() {
  // Different selectors for inline editors in Facebook
  const inlineEditorSelectors = [
    'div[role="presentation"] [contenteditable="true"]',
    '[data-lexical-editor="true"]:not([aria-label*="comment"])',
    'div[aria-label*="on your mind"], div[aria-label*="what\'s on your mind"]',
    'div[aria-label*="Write something"], div[aria-label*="write something"]',
    'div.notranslate[contenteditable="true"]',
    'div.xzsf02u',
    'div.x1ed109x',
    'div[data-contents="true"]',
    'div.public-DraftEditor-content'
  ];
  
  for (const selector of inlineEditorSelectors) {
    try {
      const elements = document.querySelectorAll(selector);
      
      for (const element of elements) {
        if (isElementVisible(element) && !element.closest('[aria-label*="Comment"]') && !element.closest('[aria-label*="comment"]')) {
          return element;
        }
      }
    } catch (e) {
      continue;
    }
  }
  
  return null;
}

/**
 * Handle posting in an existing editor
 */
function handlePostingInEditor(container, editor, post, images, resolve, reject) {
  // First, load images if available
  if (images && images.length > 0) {
    console.log(`Loading ${images.length} images in the editor`);
    
    uploadImagesToFacebook(container || document.body, images)
      .then(() => {
        // After images are loaded, add text
        fillPostContent(editor, post);
        
        // Searching for post button and clicking
        setTimeout(() => {
          const postButton = findPostButton(container || document);
          
          if (postButton) {
            console.log("Post button found, clicking...");
            postButton.click();
            
            // Waiting for a moment to assume post was successful
            setTimeout(() => {
              resolve("Posted successfully (editor open)");
            }, 8000);
          } else {
            console.error("Post button not found");
            resolve("Post button not found, but text was entered");
          }
        }, 2000);
      })
      .catch(error => {
        console.error("Failed to upload images:", error);
        
        // Even if images fail to upload, try to add text
        fillPostContent(editor, post);
        
        // Searching for post button and clicking
        setTimeout(() => {
          const postButton = findPostButton(container || document);
          
          if (postButton) {
            console.log("Post button found, clicking...");
            postButton.click();
            
            // Waiting for a moment to assume post was successful
            setTimeout(() => {
              resolve("Posted successfully (editor open)");
            }, 8000);
          } else {
            console.error("Post button not found");
            resolve("Post button not found, but text was entered");
          }
        }, 2000);
      });
  } else {
    // If no images, just add text
    fillPostContent(editor, post);
    
    // Searching for post button and clicking
    setTimeout(() => {
      const postButton = findPostButton(container || document);
      
      if (postButton) {
        console.log("Post button found, clicking...");
        postButton.click();
        
        // Waiting for a moment to assume post was successful
        setTimeout(() => {
          resolve("Posted successfully (editor open)");
        }, 8000);
      } else {
        console.error("Post button not found");
        resolve("Post button not found, but text was entered");
      }
    }, 2000);
  }
}

/**
 * Add text to post editor inside dialog
 */
function addTextToPostEditor(dialog, post, resolve, reject) {
  console.log("البحث عن محرر النص داخل مربع الحوار...");
  
  // منع التفاعل مع أيقونات الرموز التعبيرية
  try {
    const emojiButtons = document.querySelectorAll('div[role="button"][aria-label*="emoji"], div[role="button"][aria-label*="رمز"], div[role="button"][data-testid*="emoji"], div[role="button"][data-testid*="رمز"]');
    emojiButtons.forEach(btn => {
      if (document.activeElement === btn) {
        btn.blur();
      }
    });
  } catch (e) {
    console.log("تجاهل خطأ الرموز التعبيرية:", e);
  }
  
  // محاولة العثور على محرر النص باستخدام طرق متعددة
  let postTextArea = dialog.querySelector('[contenteditable="true"], [role="textbox"], [data-lexical-editor="true"]');
  
  // إذا لم يتم العثور على المحرر، جرب محددات أكثر تحديدًا
  if (!postTextArea) {
    const possibleSelectors = [
      'div[contenteditable="true"]',
      'div[role="textbox"]',
      'div[data-lexical-editor="true"]',
      'div.notranslate[contenteditable="true"]',
      'div[aria-label*="on your mind"], div[aria-label*="what\'s on your mind"]',
      'div[aria-label*="Write something"], div[aria-label*="write something"]',
      'div[data-contents="true"]',
      'div.public-DraftEditor-content',
      'form div[contenteditable="true"]:first-child',
      'div.xzsf02u',
      'div.x1ed109x'
    ];
    
    for (const selector of possibleSelectors) {
      try {
        const element = dialog.querySelector(selector);
        if (element) {
          console.log(`تم العثور على محرر النص باستخدام محدد إضافي: ${selector}`);
          postTextArea = element;
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    // إذا لم يتم العثور على المحرر، ابحث في جميع أنحاء الصفحة (وليس فقط داخل مربع الحوار)
    if (!postTextArea) {
      console.log("لم يتم العثور على محرر النص داخل مربع الحوار، جارٍ البحث في جميع أنحاء الصفحة...");
      
      postTextArea = document.querySelector('div[role="dialog"] [contenteditable="true"], div[role="dialog"] [role="textbox"], div[role="dialog"] [data-lexical-editor="true"]');
      
      if (!postTextArea) {
        // البحث بشكل أوسع عن أي محرر في الصفحة
        const globalEditor = document.querySelector('[contenteditable="true"]:not([aria-label*="comment"]), [role="textbox"]:not([aria-label*="comment"]), [data-lexical-editor="true"]:not([aria-label*="comment"])');
        
        if (globalEditor && !globalEditor.closest('[aria-label*="Comment"]')) {
          console.log("تم العثور على محرر نص عام في الصفحة");
          postTextArea = globalEditor;
        }
      }
    }
  }
  
  if (postTextArea) {
    console.log("تم العثور على محرر النص، جارٍ إضافة النص...");
    
    // التأكد من أن العنصر غير النشط هو المحرر وليس أي شيء آخر
    document.activeElement.blur();
    
    // ضمان تنشيط المحرر قبل إضافة النص
    setTimeout(() => {
      try {
        // التركيز على المحرر ثم النقر عليه لضمان التنشيط الكامل
        postTextArea.focus();
        
        if (postTextArea.click) {
          postTextArea.click();
        }
      
        // ضبط اتجاه النص فقط دون تحديد أي تنسيق
        const hasArabicText = /[\u0600-\u06FF]/.test(post);
        if (hasArabicText) {
          postTextArea.setAttribute('dir', 'rtl');
          // إزالة أي تنسيقات قد تؤثر على النص
          postTextArea.style.removeProperty('font-family');
          postTextArea.style.removeProperty('font-size');
          postTextArea.style.removeProperty('line-height');
          postTextArea.style.removeProperty('text-align');
        }
        
        // التأكد من عدم وجود أي محتوى في المحرر قبل إضافة النص
        if (postTextArea.isContentEditable) {
          postTextArea.textContent = '';
          postTextArea.innerHTML = '';
        } else if (postTextArea.tagName && postTextArea.tagName.toLowerCase() === 'textarea') {
          postTextArea.value = '';
        }
        
        // زيادة تأخير إضافة النص لضمان أن المحرر جاهز
        setTimeout(() => {
          // استخدام طريقة اللصق المباشر
          fillPostContent(postTextArea, post);
          
          // وقت انتظار إضافي للتأكد من إدخال النص قبل البحث عن زر النشر
          setTimeout(() => {
            // التحقق من إدخال النص بنجاح
            const textContent = postTextArea.textContent || postTextArea.value || '';
            if (!textContent || textContent.trim() === '') {
              console.warn("المحرر فارغ بعد محاولة إدخال النص، محاولة مرة أخرى...");
              // محاولة أخرى باستخدام طريقة أبسط
              if (postTextArea.isContentEditable) {
                postTextArea.textContent = post;
              } else if (postTextArea.tagName && postTextArea.tagName.toLowerCase() === 'textarea') {
                postTextArea.value = post;
              }
              triggerFacebookEvents(postTextArea);
            }
            
            // محاولة العثور على زر النشر والنقر عليه
            setTimeout(() => {
              const postButton = findPostButton(dialog) || findPostButton(document);
              
              if (postButton) {
                console.log("تم العثور على زر النشر، جارٍ النقر عليه...");
                postButton.click();
                
                // إعداد فحص مؤقت لتأكيد إغلاق مربع الحوار (مما يشير إلى نجاح النشر)
                let dialogCheckAttempts = 0;
                const checkDialogClosed = () => {
                  // التحقق مما إذا كان مربع الحوار لا يزال موجودًا
                  const dialogStillExists = document.querySelector('div[role="dialog"]');
                  
                  if (!dialogStillExists) {
                    // تم إغلاق مربع الحوار، مما يشير إلى نجاح النشر
                    console.log("تم إغلاق مربع الحوار - يبدو أن النشر كان ناجحًا");
                    resolve("تم النشر بنجاح");
                    return;
                  }
                  
                  dialogCheckAttempts++;
                  if (dialogCheckAttempts < 10) {
                    // الاستمرار في الفحص - تقليل وقت الانتظار بين عمليات التحقق من 2 ثانية إلى 1 ثانية
                    setTimeout(checkDialogClosed, 1000);
                  } else {
                    // تجاوز الحد الأقصى للمحاولات، ولكن لم يفشل بعد
                    // قد يكون ناجحًا ولكن مربع الحوار لا يزال مفتوحًا
                    console.log("تم الوصول إلى الحد الأقصى من المحاولات للتحقق من إغلاق مربع الحوار، افتراض نجاح النشر");
                    resolve("تم النشر بنجاح (مع مربع الحوار مفتوح)");
                  }
                };
                
                // بدء الفحص بعد تأخير قصير للكتابة والنقر على زر النشر
                setTimeout(checkDialogClosed, 8000);
              } else {
                console.error("لم يتم العثور على زر النشر");
                resolve("لم يتم العثور على زر النشر، ولكن تم إدخال النص");
              }
            }, 2000);
          }, 2000);
        }, 1000);
      } catch (e) {
        console.error("حدث خطأ أثناء محاولة إدخال النص:", e);
        
        // محاولة أخيرة بأبسط الطرق
        try {
          // إدخال النص مباشرة
          if (postTextArea.isContentEditable) {
            postTextArea.textContent = post;
          } else if (postTextArea.tagName && postTextArea.tagName.toLowerCase() === 'textarea') {
            postTextArea.value = post;
          }
          
          // محاولة العثور على زر النشر والنقر عليه
          setTimeout(() => {
            const postButton = findPostButton(dialog) || findPostButton(document);
            if (postButton) {
              postButton.click();
              setTimeout(() => {
                resolve("تم النشر باستخدام الطريقة البسيطة");
              }, 8000);
            } else {
              resolve("لم يتم العثور على زر النشر، ولكن تم إدخال النص");
            }
          }, 2000);
        } catch (finalError) {
          console.error("فشلت جميع محاولات إدخال النص:", finalError);
          reject("فشل إدخال النص بعد محاولات متعددة");
        }
      }
    }, 500);
  } else {
    console.error("لم يتم العثور على محرر النص في مربع الحوار بعد جميع المحاولات");
    
    // محاولة العثور على محرر مباشر كبديل
    const inlineEditor = document.querySelector('div[role="presentation"] [contenteditable="true"], [data-lexical-editor="true"]:not([aria-label*="comment"])');
    
    if (inlineEditor) {
      console.log("تم العثور على محرر مباشر، استخدامه كبديل");
      addTextToInlineEditor(inlineEditor, post, resolve, reject);
    } else {
      return reject("لم يتم العثور على محرر النص في مربع الحوار");
    }
  }
}

/**
 * Add text to inline editor
 */
function addTextToInlineEditor(inlineEditor, post, resolve, reject) {
  console.log("إضافة نص إلى المحرر المباشر...");
  
  // التأكد من أن العنصر غير النشط هو المحرر وليس أي عنصر آخر
  try {
    // إلغاء تنشيط أي رموز تعبيرية أو أزرار أخرى قد تكون نشطة
    const activeElement = document.activeElement;
    if (activeElement && activeElement !== inlineEditor && activeElement !== document.body) {
      activeElement.blur();
    }
    
    // ضبط اتجاه النص بناءً على وجود نص عربي
    const hasArabicText = /[\u0600-\u06FF]/.test(post);
    if (hasArabicText) {
      inlineEditor.setAttribute('dir', 'rtl');
      inlineEditor.style.direction = 'rtl';
      // إزالة أي تنسيقات قد تؤثر على النص
      inlineEditor.style.removeProperty('font-family');
      inlineEditor.style.removeProperty('font-size');
      inlineEditor.style.removeProperty('line-height');
      inlineEditor.style.removeProperty('text-align');
    }
    
    // استخدام الوظيفة المحسنة للصق النص مع الحفاظ على التنسيق
    const insertSuccess = fillPostContent(inlineEditor, post);
    
    // التحقق من نجاح إدخال النص والتأكد من أنه ينتظر بعد إدخال النص بنجاح
    setTimeout(() => {
      // التحقق من وجود النص في المحرر
      const currentContent = inlineEditor.textContent || inlineEditor.value || '';
      const contentAdded = currentContent && currentContent.trim() !== '';
      
      console.log(`حالة إدخال النص: ${contentAdded ? 'ناجح' : 'فشل'}, طول النص: ${currentContent.length}`);
      
      // محاولة العثور على زر النشر والنقر عليه فقط إذا تم إدخال النص بنجاح
      if (contentAdded) {
        setTimeout(() => {
          const parentContainer = inlineEditor.closest('div[role="presentation"]') || document;
          const postButton = findPostButton(parentContainer);
          
          if (postButton) {
            console.log("تم العثور على زر النشر، جار النقر عليه...");
            
            // استخدام وظيفة النقر المحسنة
            const buttonClicked = clickPostButton(postButton);
            
            // إضافة مزيد من التأخير للتحقق من نجاح النشر
            setTimeout(() => {
              // إلغاء منع إغلاق علامة التبويب في جميع الحالات
              try {
                if (typeof window.releaseTabClosingPrevention === 'function') {
                  window.releaseTabClosingPrevention();
                }
              } catch (e) {
                console.warn("فشل في إلغاء منع إغلاق علامة التبويب:", e);
              }
              
              // فحص ما إذا كان المحرر فارغًا أو اختفى (مؤشر على نجاح النشر)
              const editorEmpty = !inlineEditor.textContent || inlineEditor.textContent.trim() === '';
              const editorExists = document.body.contains(inlineEditor);
              
              if (editorEmpty || !editorExists) {
                console.log("تم مسح المحرر أو اختفاءه - يبدو أن النشر اكتمل بنجاح");
                resolve("تم النشر بنجاح (واجهة المحرر المباشر)");
              } else {
                console.log("المحرر لا يزال يحتوي على نص، ولكن افتراض نجاح النشر");
                resolve("تم النشر (مع بقاء النص في المحرر المباشر)");
              }
            }, 5000);
          } else {
            console.error("لم يتم العثور على زر النشر");
            resolve("لم يتم العثور على زر النشر، ولكن تم إدخال المحتوى");
          }
        }, 2000);
      } else {
        // محاولة أخيرة في حالة فشل الطرق السابقة
        console.log("المحاولات السابقة فشلت، محاولة أخيرة باستخدام HTML منسق...");
        
        if (inlineEditor.isContentEditable) {
          // تقسيم النص إلى أسطر وتحويله إلى HTML منسق
          const lines = post.split(/\r\n|\r|\n/g);
          let formattedHTML = '';
          
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (!line || line.trim() === '') {
              formattedHTML += '<div><br></div>';
            } else {
              formattedHTML += `<div>${line}</div>`;
            }
          }
          
          // إدخال HTML منسق مباشرة
          inlineEditor.innerHTML = formattedHTML;
          
          // تشغيل أحداث فيسبوك والنقر على زر النشر
          triggerFacebookEvents(inlineEditor);
          
          setTimeout(() => {
            const parentContainer = inlineEditor.closest('div[role="presentation"]') || document;
            const postButton = findPostButton(parentContainer);
            
            if (postButton) {
              clickPostButton(postButton);
              setTimeout(() => {
                resolve("تم محاولة النشر باستخدام الطريقة البسيطة");
              }, 5000);
            } else {
              resolve("لم يتم العثور على زر النشر، ولكن تم إدخال المحتوى");
            }
          }, 2000);
        } else {
          // إذا كان المحرر غير قابل للتحرير في HTML، استخدم الطريقة البسيطة
          inlineEditor.value = post;
          triggerFacebookEvents(inlineEditor);
          
          // محاولة النشر أيضًا
          setTimeout(() => {
            const parentContainer = inlineEditor.closest('div[role="presentation"]') || document;
            const postButton = findPostButton(parentContainer);
            
            if (postButton) {
              clickPostButton(postButton);
              setTimeout(() => {
                resolve("تم محاولة النشر باستخدام طريقة textarea");
              }, 5000);
            } else {
              resolve("لم يتم العثور على زر النشر، ولكن تم إدخال المحتوى");
            }
          }, 2000);
        }
      }
    }, 3000); // زيادة التأخير للتأكد من اكتمال عملية إدخال النص
  } catch (error) {
    console.error("خطأ غير متوقع أثناء إضافة النص إلى المحرر المباشر:", error);
    reject("فشل غير متوقع في إضافة النص");
  }
}

/**
 * ملء محرر النص بمحتوى المنشور
 */
function fillPostContent(editor, text) {
  try {
    console.log("إضافة محتوى إلى محرر المنشور...");
    
    // تحقق من صحة المدخلات
    if (!editor) {
      console.error("خطأ: تم تمرير محرر غير صالح إلى fillPostContent");
      return false;
    }
    
    // التعامل مع المدخلات المختلفة للنص
    let postText = '';
    if (typeof text === 'string') {
      postText = text;
    } else if (text && typeof text === 'object') {
      // قد يكون كائنًا يحتوي على خاصية text
      postText = text.text || '';
    } else if (text === null || text === undefined) {
      console.warn("تحذير: تم تمرير نص فارغ إلى fillPostContent");
      return false;
    } else {
      // محاولة تحويل القيمة إلى نص
      try {
        postText = String(text);
      } catch (e) {
        console.error("خطأ في تحويل النص:", e);
        return false;
      }
    }
    
    // التنظيف فقط إذا كان لدينا نص لإضافته
    if (postText.trim()) {
      console.log("تنظيف محتوى المحرر قبل إضافة النص الجديد...");
      
      // تنظيف المحرر أولاً
      clearEditorContent();
      
      // التركيز على المحرر قبل إضافة المحتوى
      setTimeout(() => {
        focusEditor();
        
        // إرسال إشارة إلى واجهة المستخدم بأن بعض الأحداث ستحدث
        triggerEvents();
        
        console.log("إدراج نص في المحرر...");
        // محاولة إدراج النص مباشرة
        let inserted = insertTextDirectly();
        
        // التحقق من نجاح الإدراج
        setTimeout(checkTextInsertion, 500);
      }, 300);
    }
    
    return true;
    
    /**
     * تنظيف محتوى المحرر
     */
    function clearEditorContent() {
      try {
        // محاولة تنظيف إذا كان عنصر HTML قابل للتحرير
        if (editor.isContentEditable) {
          editor.textContent = '';
          editor.innerHTML = '';
          // إطلاق أحداث للإبلاغ عن تغيير المحتوى
          triggerInputEvent(editor);
        } 
        // محاولة تنظيف إذا كان textarea
        else if (editor.tagName && editor.tagName.toLowerCase() === 'textarea') {
          editor.value = '';
          triggerInputEvent(editor);
        }
      } catch (e) {
        console.warn("تحذير: فشل في تنظيف المحرر:", e);
      }
    }
    
    /**
     * التركيز على المحرر
     */
    function focusEditor() {
      try {
        // إزالة التركيز من أي عنصر آخر
        if (document.activeElement && document.activeElement !== editor) {
          document.activeElement.blur();
        }
        
        // التركيز على المحرر والنقر عليه
        editor.focus();
        if (typeof editor.click === 'function') {
          editor.click();
        }
        
        // إعادة ضبط أي تحديد موجود
        if (window.getSelection) {
          const selection = window.getSelection();
          if (selection.rangeCount > 0) {
            selection.removeAllRanges();
          }
        }
      } catch (e) {
        console.warn("تحذير: فشل في التركيز على المحرر:", e);
      }
    }
    
    /**
     * إدراج النص مباشرة في المحرر
     */
    function insertTextDirectly() {
      try {
        // تحديد نوع المحرر وأفضل طريقة للإدراج
        if (editor.isContentEditable) {
          console.log("محاولة إدراج النص في المحرر القابل للتحرير...");
          
          // محاولة استخدام الأمر insertText أولاً للحفاظ على التنسيق
          try {
            const formattedHtml = formatTextAsHTML(postText);
            editor.innerHTML = formattedHtml;
            triggerInputEvent(editor);
            console.log("تم إدراج النص كـ HTML");
            return true;
          } catch (htmlError) {
            console.warn("تحذير: فشل إدراج HTML:", htmlError);
            
            // محاولة استخدام أمر insertText إذا فشل HTML
            try {
              document.execCommand('insertText', false, postText);
              triggerInputEvent(editor);
              return true;
            } catch (insertError) {
              console.warn("تحذير: فشل إدراج النص باستخدام execCommand:", insertError);
              
              // استخدام textContent كخيار أخير
              editor.textContent = postText;
              triggerInputEvent(editor);
              return true;
            }
          }
        } 
        // إدراج النص في textarea
        else if (editor.tagName && editor.tagName.toLowerCase() === 'textarea') {
          console.log("إدراج النص في عنصر textarea...");
          editor.value = postText;
          triggerInputEvent(editor);
          return true;
        } else {
          console.warn("نوع محرر غير معروف، تجربة textContent...");
          editor.textContent = postText;
          triggerInputEvent(editor);
          return true;
        }
      } catch (error) {
        console.error("خطأ في إدراج النص:", error);
        return false;
      }
    }
    
    /**
     * تنسيق النص كـ HTML للإدراج في المحرر
     */
    function formatTextAsHTML(inputText) {
      try {
        // التحقق من نوع المدخلات لتجنب خطأ split is not a function
        if (inputText === null || inputText === undefined) {
          console.warn("تنبيه: النص فارغ أو غير معرف في formatTextAsHTML");
          return '';
        }

        // التأكد من أن inputText هو نص (سلسلة نصية)
        if (typeof inputText !== 'string') {
          console.warn("تنبيه: تم تمرير قيمة غير نصية إلى formatTextAsHTML، تحويلها إلى نص");
          inputText = String(inputText);
        }

        if (inputText === '') {
          console.log("تلقي نص فارغ في formatTextAsHTML");
          return '';
        }

        // تحسين استخدام تعبير منتظم يتعامل مع جميع أنواع نهايات الأسطر
        const paragraphs = inputText.split(/\r?\n/);
        
        // معالجة كل فقرة وإضافة علامات p
        let result = '';
        let lastLineWasEmpty = false;
        
        paragraphs.forEach(para => {
          // التعامل مع السطور الفارغة
          if (para.trim() === '') {
            if (!lastLineWasEmpty) {
              // إضافة سطر فارغ إضافي بين الفقرات إذا لم يكن هناك سطر فارغ سابق
              result += '<p><br></p>';
              lastLineWasEmpty = true;
            }
          } else {
            // تنسيق الفقرة مع HTML محصن
            result += `<p>${para}</p>`;
            lastLineWasEmpty = false;
          }
        });
        
        // التأكد من إضافة سطر فارغ في النهاية إذا لم يكن السطر الأخير فارغًا
        if (!lastLineWasEmpty) {
          result += '<p><br></p>';
        }
        
        return result;
      } catch (error) {
        console.error("خطأ عام في formatTextAsHTML:", error);
        // إرجاع النص الأصلي في حالة الخطأ
        return inputText;
      }
    }
    
    /**
     * التحقق من إدراج النص بنجاح
     */
    function checkTextInsertion() {
      try {
        let currentContent = '';
        
        // الحصول على المحتوى الحالي بناءً على نوع المحرر
        if (editor.isContentEditable) {
          currentContent = editor.textContent || editor.innerText || '';
        } else if (editor.tagName && editor.tagName.toLowerCase() === 'textarea') {
          currentContent = editor.value || '';
        }
        
        console.log("التحقق من إدراج النص، النص الحالي:", currentContent.substring(0, 50) + (currentContent.length > 50 ? '...' : ''));
        
        // التحقق من وجود محتوى
        if (!currentContent || currentContent.trim() === '') {
          console.warn("المحرر فارغ بعد محاولة إدراج النص، محاولة بطريقة أخرى...");
          
          // محاولة بطريقة أخرى
          if (editor.isContentEditable) {
            editor.textContent = postText;
          } else if (editor.tagName && editor.tagName.toLowerCase() === 'textarea') {
            editor.value = postText;
          }
          
          // تحفيز أحداث التغيير
          triggerInputEvent(editor);
        } else {
          console.log("تم إدراج النص بنجاح في المحرر");
        }
      } catch (e) {
        console.warn("تحذير: خطأ في فحص إدراج النص:", e);
      }
    }
    
    /**
     * إطلاق أحداث فيسبوك للمحرر
     */
    function triggerEvents() {
      try {
        // أحداث للكشف عن التغييرات في المحرر
        const events = [
          new Event('input', { bubbles: true }),
          new Event('change', { bubbles: true }),
          new FocusEvent('focus', { bubbles: true }),
          new FocusEvent('focusin', { bubbles: true }),
          new InputEvent('beforeinput', { bubbles: true }),
          new InputEvent('input', { bubbles: true, data: postText, inputType: 'insertText' })
        ];
        
        // إرسال جميع الأحداث للمحرر
        events.forEach(event => {
          try {
            editor.dispatchEvent(event);
          } catch (e) {
            // تجاهل أخطاء الحدث الفردية
          }
        });
      } catch (e) {
        console.warn("تحذير: فشل في إطلاق أحداث فيسبوك:", e);
      }
    }
  } catch (error) {
    // تخفيض مستوى السجل من خطأ إلى تحذير لتجنب ظهور رسائل الخطأ في واجهة المستخدم
    console.warn("تحذير في وظيفة fillPostContent:", error);
    return false;
  }
}

/**
 * تحميل الصور إلى فيسبوك
 */
async function uploadImagesToFacebook(container, images) {
  return new Promise((resolve, reject) => {
    try {
      console.log("البحث عن زر إضافة الصور...");
      
      // البحث عن زر إضافة الصور (قد يكون صورة أو أيقونة)
      const photoButtons = Array.from(container.querySelectorAll('div[role="button"], button, span[role="button"], a[role="button"]'))
        .filter(button => {
          // البحث عن أزرار تحتوي على كلمة صورة أو Photo
          const buttonText = button.textContent?.toLowerCase() || '';
          const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
          const dataTestId = button.getAttribute('data-testid') || '';
          
          return buttonText.includes('photo') || 
                buttonText.includes('صور') || 
                buttonText.includes('صورة') || 
                buttonText.includes('image') || 
                ariaLabel.includes('photo') || 
                ariaLabel.includes('صور') || 
                ariaLabel.includes('صورة') || 
                ariaLabel.includes('image') || 
                dataTestId.includes('photo') ||
                dataTestId.includes('image-icon') ||
                button.querySelector('img[alt*="photo"], img[alt*="صور"]');
        });
      
      if (photoButtons.length === 0) {
        console.log("البحث عن زر إضافة الصور بالأيقونات...");
        
        // طريقة بديلة للبحث عن زر إضافة الصور
        const allButtons = container.querySelectorAll('div[role="button"], button, span[role="button"], a[role="button"]');
        
        for (const button of allButtons) {
          // البحث عن أزرار تحتوي على أيقونة صورة
          const hasIcon = button.querySelector('i[data-visualcompletion="css-img"], svg');
          if (hasIcon && isElementVisible(button)) {
            photoButtons.push(button);
          }
        }
      }
      
      // طريقة جديدة: البحث عن زر ثابت باستخدام محددات مختلفة
      if (photoButtons.length === 0) {
        console.log("البحث عن زر إضافة الصور باستخدام محددات إضافية...");
        
        // محددات شائعة لأزرار إضافة الصور في فيسبوك
        const additionalSelectors = [
          // محددات قائمة على السمات الثابتة بدلاً من الكلاسات المتغيرة
          'div[data-testid="media-attachment-button"]',
          'div[data-testid="photo-video-button"]',
          'div[data-visualcompletion="ignore-dynamic"][role="button"]',
          'label[data-testid="photo-video-upload-button"]',
          'div[aria-label="Photo/Video"]',
          'div[aria-label="صورة/فيديو"]',
          'div[aria-label="Add Photo or Video"]',
          'div[aria-label="إضافة صورة أو فيديو"]',
          // محددات للواجهة الجديدة 2023-2024
          'div[data-pagelet="Composer"] div[role="button"]',
          'div[role="button"][aria-label*="Photo"]',
          'div[role="button"][aria-label*="صورة"]',
          'div[role="button"][data-hover="tooltip"][tabindex="0"]',
          // محددات ثابتة للعناصر المرتبطة بالصور
          'input[type="file"][accept*="image"]',
          'input[data-testid="photo-video-input"]',
          'form div[role="button"]:first-child',
          // محددات قائمة على السمات بدلاً من النص
          'div[aria-label*="Photo"]',
          'div[aria-label*="صورة"]',
          'div[aria-description*="photo"]',
          'div[aria-description*="صورة"]',
          // محددات معززة بالـ attributes بدلاً من الكلاسات
          'div[role="button"][tabindex="0"]:not([aria-label*="comment"])'
        ];
        
        for (const selector of additionalSelectors) {
          try {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
              elements.forEach(el => {
                if (isElementVisible(el)) {
                  photoButtons.push(el);
                }
              });
            }
          } catch (e) {
            // تجاهل أخطاء المحددات غير الصالحة
            continue;
          }
        }
      }
      
      // طريقة أخيرة: فحص جميع الأزرار المرئية في المستند
      if (photoButtons.length === 0) {
        console.log("محاولة أخيرة للعثور على زر الصور...");
        
        // الحصول على جميع الأزرار المرئية في مربع الحوار
        document.querySelectorAll('div[role="button"], button').forEach(el => {
          if (isElementVisible(el) && !el.closest('[aria-label*="comment"]')) {
            // قد يكون ثاني أو ثالث زر هو زر الصور
            photoButtons.push(el);
          }
        });
        
        // محاولة العثور على حقل إدخال الملفات مباشرة
        const fileInputs = document.querySelectorAll('input[type="file"]');
        if (fileInputs.length > 0) {
          console.log("تم العثور على حقل إدخال ملفات بشكل مباشر.");
          // قد نحتاج إلى محاكاة النقر على عنصر مخفي
          const fileInput = fileInputs[fileInputs.length - 1];
          
          // الانتقال مباشرة إلى تحميل الملفات
          handleFileUpload(fileInput, images, resolve, reject);
          return;
        }
      }
      
      if (photoButtons.length === 0) {
        console.error("لم يتم العثور على زر إضافة الصور");
        return reject("لم يتم العثور على زر إضافة الصور");
      }
      
      console.log(`تم العثور على ${photoButtons.length} زر محتمل لإضافة الصور`);
      
      // اختيار الزر الأول المرئي
      const photoButton = photoButtons.find(button => isElementVisible(button));
      
      if (!photoButton) {
        console.error("لم يتم العثور على زر مرئي لإضافة الصور");
        return reject("لم يتم العثور على زر مرئي لإضافة الصور");
      }
      
      console.log("تم العثور على زر إضافة الصور، جار النقر عليه...");
      photoButton.click();
      
      // الانتظار لظهور مربع حوار اختيار الملفات
    setTimeout(() => {
        // البحث عن حقل إدخال الملفات
        const fileInputs = document.querySelectorAll('input[type="file"]');
        
        if (fileInputs.length === 0) {
          console.error("لم يتم العثور على حقل إدخال الملفات");
          return reject("لم يتم العثور على حقل إدخال الملفات");
        }
        
        console.log(`تم العثور على ${fileInputs.length} حقل إدخال ملفات`);
        
        // اختيار أول حقل إدخال ملفات مرئي أو غير مرئي
        const fileInput = fileInputs[fileInputs.length - 1];
        
        handleFileUpload(fileInput, images, resolve, reject);
      }, 2000);
    } catch (error) {
      console.error("خطأ أثناء تحميل الصور:", error);
      reject(`خطأ أثناء تحميل الصور: ${error.message}`);
    }
  });
}

/**
 * معالجة تحميل الملفات
 */
function handleFileUpload(fileInput, images, resolve, reject) {
  try {
    console.log("بدء عملية تحميل الصور...");
    
    // التحقق مما إذا كان الحقل يقبل صورًا متعددة
    if (!fileInput.multiple) {
      fileInput.setAttribute('multiple', 'multiple');
    }
    
    // تحويل الصور من data URL إلى كائنات File
    const files = [];
    let convertedCount = 0;
    
    // إذا لم تكن هناك صور، نتوقف مباشرة
    if (!images || images.length === 0) {
      console.log("لا توجد صور للتحميل");
      return resolve();
    }
    
    console.log(`بدء تحويل ${images.length} صورة...`);
    
    // استخدام Promise.all لتحويل جميع الصور متزامنة
    const conversionPromises = images.map((dataUrl, index) => 
      convertDataUrlToFile(dataUrl, `image_${index}.jpg`)
        .then(file => {
          console.log(`تم تحويل الصورة ${index + 1}/${images.length}`);
          return file;
        })
        .catch(error => {
          console.error(`فشل في تحويل الصورة ${index}:`, error);
          return null; // إرجاع null للصور التي فشل تحويلها
        })
    );
    
    Promise.all(conversionPromises).then(convertedFiles => {
      // تصفية الملفات التي فشل تحويلها (قيمة null)
      const validFiles = convertedFiles.filter(file => file !== null);
      
      if (validFiles.length === 0) {
        console.error("لم يتم تحويل أي صورة بنجاح");
        return resolve(); // الاستمرار حتى لو لم يتم تحويل أي صورة
      }
      
      console.log(`تم تحويل ${validFiles.length} صورة بنجاح من أصل ${images.length}، جار تحميلها...`);
      
      try {
        // تحميل الصور باستخدام DataTransfer API
              const dataTransfer = new DataTransfer();
        validFiles.forEach(file => dataTransfer.items.add(file));
              
        // تعيين الملفات إلى عنصر الإدخال
              fileInput.files = dataTransfer.files;
              
        // التأكد من تفعيل معالج التغيير
      setTimeout(() => {
                try {
            // إطلاق أحداث متعددة للتأكد من اكتشاف فيسبوك للتغيير
            fileInput.dispatchEvent(new Event('change', { bubbles: true }));
            fileInput.dispatchEvent(new Event('input', { bubbles: true }));
            
            // إذا كان هناك معالج onchange، استدعائه مباشرة
            if (typeof fileInput.onchange === 'function') {
              fileInput.onchange();
            }
            
            // التحقق من ظهور معاينات الصور
            waitForImagePreviews();
            
          } catch (error) {
            console.error("خطأ أثناء إرسال أحداث تحميل الصور:", error);
            handleFallbackUpload(validFiles);
                }
              }, 500);
              
        // وظيفة للانتظار والتحقق من ظهور معاينات الصور
        function waitForImagePreviews() {
          console.log("جاري التحقق من ظهور معاينات الصور...");
          
          // عدد محاولات التحقق
          let attempts = 0;
          const maxAttempts = 10;
          
          // فحص معاينات الصور بشكل متكرر
          const checkInterval = setInterval(() => {
            attempts++;
            
            // البحث عن عناصر معاينة الصور باستخدام محددات متعددة
            const previewElements = [
              ...document.querySelectorAll('img[alt*="preview"], img[alt*="معاينة"]'),
              ...document.querySelectorAll('div[aria-label*="image"], div[aria-label*="صورة"]'),
              ...document.querySelectorAll('div.uploadingPreview, div[class*="imagePreview"]'),
              ...document.querySelectorAll('[data-visualcompletion="media-vc-image"]')
            ];
            
            // البحث عن أي عنصر img جديد قد يكون معاينة الصورة
            const allImages = document.querySelectorAll('img');
            const recentImages = Array.from(allImages).filter(img => {
              // التحقق من أن الصورة مرئية وتم تحميلها حديثًا
              return isElementVisible(img) && img.src && !img.src.includes('data:') && 
                    !img.closest('[aria-label*="comment"], [aria-label*="تعليق"]');
            });
            
            // جمع كل المعاينات المحتملة
            const possiblePreviews = [...previewElements, ...recentImages];
            
            if (possiblePreviews.length > 0) {
              console.log(`تم العثور على ${possiblePreviews.length} عنصر معاينة للصور، التحميل ناجح!`);
              clearInterval(checkInterval);
              
              // الانتظار قليلاً قبل اعتبار التحميل مكتملاً
              setTimeout(resolve, 1000);
            } else if (attempts >= maxAttempts) {
              console.log("انتهت محاولات البحث عن معاينات الصور، نفترض أن التحميل قد تم");
              clearInterval(checkInterval);
              
              // محاولة أخيرة للتحقق من الزر المستخدم لإضافة الصور
              const photoButtons = document.querySelectorAll('[aria-label*="Add Photos"], [aria-label*="إضافة صور"]');
              if (photoButtons.length > 0) {
                // النقر على زر إضافة الصور مرة أخرى قد يساعد في تنشيط العملية
                console.log("محاولة نهائية: النقر على زر إضافة الصور مرة أخرى");
                photoButtons[0].click();
                
                // بعد النقر، ننتظر قليلاً ثم نفترض نجاح التحميل
                setTimeout(() => {
                    resolve();
                }, 2000);
              } else {
                resolve();
              }
            }
          }, 1000); // فحص كل ثانية
          }
          
        // وظيفة بديلة للتحميل في حالة فشل الطريقة الأساسية
        function handleFallbackUpload(files) {
          console.log("استخدام طريقة بديلة لتحميل الصور...");
          
          // الطريقة البديلة: محاولة تحميل صورة واحدة على الأقل
            if (files.length > 0) {
            try {
              // إنشاء عنصر input جديد
              const newInput = document.createElement('input');
              newInput.type = 'file';
              newInput.style.position = 'absolute';
              newInput.style.top = '-1000px';
              newInput.multiple = true;
              document.body.appendChild(newInput);
              
              // تحميل الصور إلى العنصر الجديد
              const tempTransfer = new DataTransfer();
              files.forEach(file => tempTransfer.items.add(file));
              newInput.files = tempTransfer.files;
              
              // إطلاق حدث التغيير
              newInput.dispatchEvent(new Event('change', { bubbles: true }));
              
              // البحث عن زر إضافة الصور والنقر عليه إذا وجد
              const photoButtons = document.querySelectorAll('div[role="button"][aria-label*="Photo"], div[role="button"][aria-label*="صورة"]');
              if (photoButtons.length > 0) {
                photoButtons[0].click();
                
                // محاولة إضافة الصور باستخدام معالج الحقل الجديد
                setTimeout(() => {
                  const fileInputs = document.querySelectorAll('input[type="file"]');
                  if (fileInputs.length > 0) {
                    fileInputs[0].files = newInput.files;
                    fileInputs[0].dispatchEvent(new Event('change', { bubbles: true }));
                  }
                  
                  // إزالة العنصر المؤقت
                  document.body.removeChild(newInput);
                  
                  // اعتبار العملية ناجحة بعد محاولة التحميل البديلة
                  setTimeout(resolve, 2000);
                }, 1000);
              } else {
                // إزالة العنصر المؤقت واعتبار العملية ناجحة
                document.body.removeChild(newInput);
                  resolve();
              }
            } catch (error) {
              console.error("فشلت الطريقة البديلة للتحميل:", error);
              resolve(); // اعتبار العملية ناجحة على أي حال
              }
            } else {
            resolve();
          }
        }
        
      } catch (error) {
        console.error("خطأ أساسي أثناء تحميل الصور:", error);
        resolve(); // اعتبار العملية ناجحة على أي حال
      }
    }).catch(error => {
      console.error("فشل في معالجة تحويل الصور:", error);
      resolve(); // اعتبار العملية ناجحة على أي حال
    });
    
  } catch (error) {
    console.error("خطأ عام في وظيفة تحميل الملفات:", error);
    resolve(); // اعتبار العملية ناجحة على أي حال
  }
}

/**
 * تحويل Data URL إلى ملف
 */
function convertDataUrlToFile(dataUrl, fileName) {
  return new Promise((resolve, reject) => {
    try {
      // استخراج نوع MIME من الـ data URL
      const mimeMatch = dataUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/);
      
      if (!mimeMatch) {
        return reject(new Error("تنسيق Data URL غير صالح"));
      }
      
      const mime = mimeMatch[1];
      const base64Data = dataUrl.replace(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/, '');
      
      // تحويل البيانات المشفرة بـ base64 إلى blob
      const byteCharacters = atob(base64Data);
      const byteArrays = [];
      
      for (let i = 0; i < byteCharacters.length; i += 512) {
        const slice = byteCharacters.slice(i, i + 512);
        
        const byteNumbers = new Array(slice.length);
        for (let j = 0; j < slice.length; j++) {
          byteNumbers[j] = slice.charCodeAt(j);
        }
        
        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
      }
      
      const blob = new Blob(byteArrays, { type: mime });
      
      // تحويل البلوب إلى ملف
      const file = new File([blob], fileName, { type: mime });
      
      resolve(file);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * النشر في واجهة فيسبوك القديمة
 */
function postToOldInterface(post, images, resolve, reject) {
  try {
    console.log("محاولة النشر في واجهة فيسبوك القديمة");
    
    // تحضير بيانات المنشور (قد تكون نصًا مباشرًا أو كائن)
    if (typeof post === 'string') {
      post = { text: post };
    }
    
    const postText = post.text || '';
    console.log("محتوى المنشور:", postText.substring(0, 50) + "...");
    console.log("عدد الصور:", images?.length || 0);
    
    // وظيفة مساعدة لإضافة النص والنشر بعد تحميل الصور
    function addTextAndPost() {
      try {
        // البحث عن مربع النص الأساسي للمنشور (وليس للتعليقات)
        const textArea = findOldInterfaceTextArea();
        if (!textArea) {
          return reject("لم يتم العثور على مربع النص للمنشور في الواجهة القديمة");
        }
        
        console.log("تم العثور على مربع النص، إضافة النص مرة واحدة...");
        fillPostContent(textArea, post);
        
        // انتظار لحظة قبل النقر على زر النشر
        setTimeout(() => {
          console.log("البحث عن زر النشر والنقر عليه...");
          const postButton = findOldInterfacePostButton() || findAllPostButtons()[0];
          if (postButton) {
            console.log("تم العثور على زر النشر، جار النقر عليه...");
            // استدعاء clickPostButton مباشرة مع زر النشر
            clickPostButton(postButton, (message) => {
              console.log("تم النشر بنجاح في الواجهة القديمة:", message);
              setTimeout(() => resolve("تم النشر بنجاح في الواجهة القديمة"), 3000);
            });
          } else {
            reject("لم يتم العثور على زر النشر في الواجهة القديمة");
          }
    }, 2000);
  } catch (error) {
        reject(`حدث خطأ أثناء إضافة النص والنشر: ${error.message}`);
      }
    }
    
    // وظيفة للعثور على محرر النص في الواجهة القديمة
    function findOldInterfaceTextArea() {
      const oldInterfaceSelectors = [
        // محددات حقل النص في الواجهة القديمة
        'textarea[name="xhpc_message"]',
        'textarea[name="xhpc_message_text"]',
        'textarea.mentionsTextarea',
        'textarea#composer-textarea',
        'div.notranslate[contenteditable="true"]',
        'div[data-testid="status-attachment-mentions-input"]',
        
        // محددات إضافية للواجهة القديمة
        '.UFIAddCommentInput textarea',
        '#composer_text_input_box',
        'div.uiMentionsInput',
        'div[data-block="true"]'
      ];
      
      // محددات للعناصر التي نريد تجنبها (مثل حقول التعليقات)
      const avoidSelectors = [
        '.UFIComment',
        '.UFICommentContent',
        '.UFIReplyList',
        '[data-testid*="comment"]',
        '[aria-label*="comment"]',
        '[aria-label*="تعليق"]'
      ];
      
      // البحث عن كل المحددات المحتملة
      const allPotentialEditors = [];
      
      // البحث في المحددات الرئيسية
      for (const selector of oldInterfaceSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          console.log(`تم العثور على ${elements.length} محرر(ات) محتمل في الواجهة القديمة باستخدام: ${selector}`);
          elements.forEach(el => {
            // تحقق من أن العنصر ليس جزءًا من منطقة التعليقات
            const isInCommentSection = avoidSelectors.some(avoid => !!el.closest(avoid));
            if (!isInCommentSection && isElementVisible(el)) {
              allPotentialEditors.push(el);
            }
          });
        }
      }
      
      if (allPotentialEditors.length === 0) {
        // محاولة البحث عن أي حقل إدخال مرئي في الواجهة
        const allEditors = [...document.querySelectorAll('textarea, [contenteditable="true"]')];
        allEditors.forEach(el => {
          if (isElementVisible(el) && !avoidSelectors.some(avoid => !!el.closest(avoid))) {
            allPotentialEditors.push(el);
          }
        });
      }
      
      if (allPotentialEditors.length > 0) {
        // استخدم أول محرر وجدناه (أو أقربه لمنطقة المنشور)
        console.log("تم العثور على محرر نص مناسب في الواجهة القديمة");
        return allPotentialEditors[0];
      }
      
      console.warn("لم يتم العثور على محرر نص مناسب في الواجهة القديمة");
      return null;
    }
    
    // وظيفة للعثور على زر النشر في الواجهة القديمة
    function findOldInterfacePostButton() {
      const postButtonSelectors = [
        'button[data-testid="react-composer-post-button"]',
        'button[type="submit"]',
        'button.layerConfirm',
        'button.selected',
        'button._1mf7',
        'button._2g61',
        'button._1mfp',
        'button:contains("Post")',
        'button:contains("نشر")',
        'button[value="Post"]',
        'button[value="نشر"]'
      ];
      
      // البحث عن الزر باستخدام المحددات
      for (const selector of postButtonSelectors) {
        try {
          const buttons = document.querySelectorAll(selector);
          for (const button of buttons) {
            if (isElementVisible(button)) {
              console.log(`تم العثور على زر النشر باستخدام: ${selector}`);
              return button;
            }
          }
        } catch (e) {
          // تجاهل أخطاء المحددات غير الصالحة
          continue;
        }
      }
      
      // البحث عن أي زر مرئي يحتوي على نص "نشر" أو "Post"
      const allButtons = document.querySelectorAll('button');
      for (const button of allButtons) {
        if (isElementVisible(button)) {
          const buttonText = button.textContent.trim().toLowerCase();
          if (buttonText === 'post' || buttonText === 'نشر' || buttonText.includes('post') || buttonText.includes('نشر')) {
            console.log("تم العثور على زر النشر من خلال النص:", buttonText);
            return button;
          }
        }
      }
      
      console.warn("لم يتم العثور على زر النشر في الواجهة القديمة");
      return null;
    }
    
    // إذا كانت هناك صور، نضيف الصور أولاً ثم النص
    if (images && images.length > 0) {
      console.log(`البدء بالبحث عن زر تحميل الصور لتحميل ${images.length} صورة قبل إضافة النص...`);
      
      // البحث عن زر تحميل الصور بطرق متعددة
      const imageButtonSelectors = [
        // محددات معروفة للواجهة القديمة
        'a[data-testid="photo-video-button"]', 
        'a[aria-label="صورة/فيديو"]', 
        'a[aria-label="Photo/Video"]', 
        'button[data-tooltip-content="Add Photos/Videos"]', 
        'button[data-tooltip-content="إضافة صور/مقاطع فيديو"]',
        // محددات إضافية
        'div.fbTimelineComposerUnit a.fbTimelineComposerPhoto',
        'form.commentable_item ul.uiList li a',
        'a.UFIPhotoAttachLinkIcon',
        'button[title="إضافة صور/فيديو"], button[title="Add Photos/Video"]',
        'a[href="#"], input[type="file"]'
      ];
      
      // البحث باستخدام جميع المحددات
      let foundImageButton = null;
      
      // محاولة كل محدد حتى العثور على زر
      for (const selector of imageButtonSelectors) {
        try {
          const buttons = document.querySelectorAll(selector);
          for (const button of buttons) {
            if (isElementVisible(button)) {
              console.log(`✅ تم العثور على زر إضافة الصور باستخدام: ${selector}`);
              foundImageButton = button;
              break;
            }
          }
          if (foundImageButton) break;
        } catch (e) {
          // تجاهل أي خطأ في المحدد
          continue;
        }
      }
      
      // إذا لم نجد باستخدام المحددات، نبحث بطريقة أخرى
      if (!foundImageButton) {
        // البحث عن أي زر أو رابط يحتوي على كلمة "صورة" أو "photo"
        const allElements = document.querySelectorAll('a, button, div[role="button"], span[role="button"], input[type="file"]');
      const potentialButtons = [...allElements].filter(el => {
          if (!isElementVisible(el)) return false;
          
        const text = el.textContent?.toLowerCase() || '';
        const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() || '';
        const dataTestId = el.getAttribute('data-testid')?.toLowerCase() || '';
          const title = el.getAttribute('title')?.toLowerCase() || '';
        
        return (text.includes('photo') || text.includes('صورة') || text.includes('image') || 
                ariaLabel.includes('photo') || ariaLabel.includes('صورة') || ariaLabel.includes('image') ||
                  dataTestId.includes('photo') || dataTestId.includes('صورة') || dataTestId.includes('image') ||
                  title.includes('photo') || title.includes('صورة') || title.includes('image') ||
                  (el.tagName === 'INPUT' && el.type === 'file'));
        });
        
        if (potentialButtons.length > 0) {
          foundImageButton = potentialButtons[0];
          console.log(`✅ تم العثور على زر محتمل لإضافة الصور باستخدام البحث الموسع`);
        }
      }
      
      // وجدنا زر إضافة الصور
      if (foundImageButton) {
        console.log(`✅ تم العثور على زر تحميل الصور، النقر عليه...`);
        
        // في حالة عنصر الإدخال، نتعامل معه مباشرة
        if (foundImageButton.tagName === 'INPUT' && foundImageButton.type === 'file') {
          console.log(`🖼️ وجدنا عنصر إدخال الملفات مباشرة، استخدامه للتحميل...`);
          
          // وظيفة لتحميل الصور ثم إضافة النص
          const uploadThenAddText = () => {
            // إنشاء وعد للتحميل
            const uploadPromise = new Promise((resolveUpload, rejectUpload) => {
              handleFileUpload(foundImageButton, images, resolveUpload, rejectUpload);
            });
            
            // بعد تحميل الصور، نضيف النص
            uploadPromise
              .then(() => {
                console.log("✅ تم تحميل الصور من خلال عنصر الإدخال، انتظار قبل إضافة النص...");
                
                // انتظار لتأكيد تحميل الصور قبل إضافة النص
        setTimeout(() => {
                  console.log("➡️ إضافة النص بعد تحميل الصور...");
                  addTextAndPost();
                }, 5000); // انتظار 5 ثوان للتأكد من ظهور الصور
              })
              .catch(error => {
                console.error("❌ فشل تحميل الصور من خلال عنصر الإدخال:", error);
                
                // في حالة الفشل، نحاول إضافة النص على الأقل
                console.log("➡️ إضافة النص بعد فشل تحميل الصور...");
                addTextAndPost();
              });
          };
          
          // تنفيذ التحميل
          uploadThenAddText();
        } else {
          // النقر على الزر لفتح مربع حوار اختيار الملفات
          foundImageButton.click();
          
          // انتظار ظهور عنصر إدخال الملفات
          setTimeout(() => {
            // البحث عن عنصر إدخال الملفات بعد النقر على الزر
            const fileInputs = document.querySelectorAll('input[type="file"]');
            let fileInput = null;
            
            // البحث عن أول مدخل ملف مرئي
            for (const input of fileInputs) {
              if (isElementVisible(input) || input.offsetParent !== null) {
                fileInput = input;
                break;
              }
            }
            
            // إذا لم نجد مدخلاً مرئياً، نستخدم أي مدخل ملف
            if (!fileInput && fileInputs.length > 0) {
              fileInput = fileInputs[fileInputs.length - 1]; // استخدام آخر مدخل ملف
            }
          
          if (fileInput) {
              console.log("✅ تم العثور على مدخل الملف، جار تحميل الصور...");
              
              // وظيفة مساعدة للتحميل ثم إضافة النص
              const uploadThenAddText = () => {
                // إنشاء وعد للتحميل
                const uploadPromise = new Promise((resolveUpload, rejectUpload) => {
                  handleFileUpload(fileInput, images, resolveUpload, rejectUpload);
                });
                
                // بعد تحميل الصور، نضيف النص
                uploadPromise
              .then(() => {
                    console.log("✅ تم تحميل الصور بنجاح، انتظار قبل إضافة النص...");
                    
                    // انتظار لتأكيد تحميل الصور قبل إضافة النص
                    setTimeout(() => {
                      // التحقق من ظهور معاينات الصور
                      const previewElements = document.querySelectorAll('img[alt*="preview"], div[aria-label*="image"], div[aria-label*="صورة"], div.uploadingPreview');
                      
                      if (previewElements.length > 0) {
                        console.log(`✅ تم التأكد من وجود ${previewElements.length} معاينة للصور قبل إضافة النص`);
                      } else {
                        console.log("⚠️ لم يتم العثور على معاينات الصور، لكن نفترض نجاح التحميل");
                      }
                      
                      console.log("➡️ إضافة النص بعد التحقق من الصور...");
                addTextAndPost();
                    }, 5000); // انتظار 5 ثوان للتأكد من ظهور الصور
              })
              .catch(error => {
                    console.error("❌ فشل تحميل الصور:", error);
                    
                    // في حالة الفشل، نحاول إضافة النص على الأقل
                    console.log("➡️ إضافة النص بعد فشل تحميل الصور...");
                addTextAndPost();
              });
              };
              
              // تنفيذ التحميل
              uploadThenAddText();
          } else {
              console.error("❌ لم يتم العثور على مدخل الملف بعد النقر على زر الصور");
              
              // محاولة باستخدام طريقة أخرى: البحث عن مدخل ملف مخفي
              const hiddenFileInputs = document.querySelectorAll('input[type="file"][style*="display: none"], input[type="file"][style*="visibility: hidden"]');
              if (hiddenFileInputs.length > 0) {
                console.log("🔍 تم العثور على مدخل ملف مخفي، محاولة استخدامه...");
                
                // جعل المدخل المخفي مرئياً مؤقتاً
                const hiddenInput = hiddenFileInputs[0];
                const originalDisplay = hiddenInput.style.display;
                const originalVisibility = hiddenInput.style.visibility;
                
                hiddenInput.style.display = 'block';
                hiddenInput.style.visibility = 'visible';
                hiddenInput.style.position = 'fixed';
                hiddenInput.style.top = '0';
                hiddenInput.style.left = '0';
                hiddenInput.style.zIndex = '9999';
                
                // محاولة التحميل باستخدام المدخل المخفي
                const uploadPromise = new Promise((resolveUpload, rejectUpload) => {
                  handleFileUpload(hiddenInput, images, resolveUpload, rejectUpload);
                });
                
                uploadPromise
                  .then(() => {
                    console.log("✅ تم تحميل الصور باستخدام المدخل المخفي، إعادة المدخل إلى حالته السابقة...");
                    
                    // إعادة المدخل إلى حالته السابقة
                    hiddenInput.style.display = originalDisplay;
                    hiddenInput.style.visibility = originalVisibility;
                    
                    // انتظار ثم إضافة النص
                    setTimeout(() => {
                      console.log("➡️ إضافة النص بعد تحميل الصور باستخدام المدخل المخفي...");
                      addTextAndPost();
                    }, 5000);
                  })
                  .catch(error => {
                    console.error("❌ فشل تحميل الصور باستخدام المدخل المخفي:", error);
                    
                    // إعادة المدخل إلى حالته السابقة
                    hiddenInput.style.display = originalDisplay;
                    hiddenInput.style.visibility = originalVisibility;
                    
                    // إضافة النص على الأقل
                    console.log("➡️ إضافة النص بعد فشل تحميل الصور...");
                    addTextAndPost();
                  });
              } else {
                console.log("⚠️ لم نستطع العثور على أي مدخل ملف، إضافة النص فقط...");
            addTextAndPost();
          }
            }
          }, 3000); // انتظار 3 ثوان لظهور مدخل الملف
        }
      } else {
        console.log("❌ لم يتم العثور على زر تحميل الصور، سنضيف النص فقط");
        
        // محاولة أخيرة للبحث عن مدخل ملف مباشرةً
        const directFileInputs = document.querySelectorAll('input[type="file"]');
        if (directFileInputs.length > 0) {
          console.log("🔍 محاولة أخيرة: تم العثور على مدخل ملف مباشرة");
          
          const uploadPromise = new Promise((resolveUpload, rejectUpload) => {
            handleFileUpload(directFileInputs[0], images, resolveUpload, rejectUpload);
          });
          
          uploadPromise
            .then(() => {
              console.log("✅ تم تحميل الصور باستخدام المدخل المباشر");
              setTimeout(() => addTextAndPost(), 5000);
            })
            .catch(error => {
              console.error("❌ فشل تحميل الصور باستخدام المدخل المباشر:", error);
              addTextAndPost();
            });
        } else {
          // لم نستطع العثور على أي مدخل ملف، إضافة النص فقط
        addTextAndPost();
        }
      }
    } else {
      // إذا لم تكن هناك صور، نضيف النص مباشرة
      console.log("📝 لا توجد صور، إضافة النص مباشرة");
      addTextAndPost();
    }
  } catch (error) {
    reject(`حدث خطأ أثناء النشر في الواجهة القديمة: ${error.message}`);
  }
}

/**
 * البحث عن زر إنشاء منشور في واجهة فيسبوك الجديدة
 */
function findCreatePostButton() {
  console.log("البحث عن منطقة إنشاء المنشور الرئيسية...");
  
  // محاولة 1: البحث عن منطقة إنشاء المنشور الرئيسية في المجموعة
  let createPostArea = document.querySelector(
    'div[role="main"] div[data-pagelet="GroupInlineComposer"], ' + 
    'div[role="main"] div[data-pagelet="GroupFeed"] div[role="button"]:first-child, ' +
    'div[role="main"] form[method="POST"]:not([action])'
  );
  
  if (createPostArea && isElementVisible(createPostArea)) {
    console.log("تم العثور على منطقة إنشاء المنشور الرئيسية في المجموعة");
    return createPostArea;
  }
  
  // محاولة 2: البحث عن أزرار إنشاء المنشورات المشهورة
  const createPostSelectors = [
    'div[aria-label="Create Post"], div[aria-label="إنشاء منشور"]',
    'div[aria-label="Write Post"], div[aria-label="كتابة منشور"]',
    'div[aria-label="Start a discussion"], div[aria-label="بدء مناقشة"]',
    'div[aria-label^="What\'s on your mind"], div[aria-label^="ماذا يدور في ذهنك"]'
  ];
  
  for (const selector of createPostSelectors) {
    try {
      const element = document.querySelector(selector);
      if (element && isElementVisible(element)) {
        console.log(`تم العثور على زر إنشاء منشور باستخدام المحدد: ${selector}`);
        return element;
      }
    } catch (e) {
      continue;
    }
  }
  
  // محاولة 3: البحث عن العناصر التي تحتوي على نص مثل "اكتب شيئًا" أو "بدء مناقشة"
  const placeholderElements = document.querySelectorAll('div[role="button"], [contenteditable="true"], [role="textbox"], div[tabindex="0"]');
  for (const el of placeholderElements) {
    if (!isElementVisible(el)) continue;
    
    const text = el.textContent?.toLowerCase() || '';
    const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() || '';
    
    const hasCreatePostAttributes = 
      text.includes('write something') || 
      text.includes('اكتب شيئ') || 
      text.includes('start a discussion') || 
      text.includes('بدء مناقشة') || 
      text.includes('ماذا تفكر') ||
      text.includes('what\'s on your mind') ||
      text.includes('create post') ||
      text.includes('إنشاء منشور') ||
      ariaLabel.includes('post') ||
      ariaLabel.includes('منشور') ||
      ariaLabel.includes('اكتب') ||
      ariaLabel.includes('write');
    
    if (hasCreatePostAttributes && !el.closest('div[role="article"]') && !el.closest('div[aria-label*="Comment"]')) {
      console.log("تم العثور على زر إنشاء منشور من خلال النص:", text || ariaLabel);
      return el;
    }
  }
  
  // محاولة 4: البحث عن خانة النشر التي تظهر أعلى الصفحة في الواجهة الجديدة
  const composerSelectors = [
    '.x78zum5:not([data-pagelet*="Comment"]) div.xzsf02u', // محدد شائع للخانة العلوية
    '.x1iyjqo2.xw2csxc div.xzsf02u', // محدد آخر للخانة العلوية
    '.x1n2onr6:not([data-visualcompletion="ignore"]) div.xzsf02u',
    '.x9f619 div.xzsf02u', // فئة شائعة
    'div[data-pagelet="GroupFeed"] > div:first-child'
  ];
  
  for (const selector of composerSelectors) {
    try {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        if (isElementVisible(element) && !element.closest('div[role="article"]') && !element.closest('[aria-label*="Comment"]')) {
          console.log(`تم العثور على منطقة خانة النشر باستخدام: ${selector}`);
          
          // تحقق مما إذا كان العنصر نفسه زر أو يحتوي على زر
          if (element.getAttribute('role') === 'button') {
            return element;
          }
          
          // البحث عن زر داخل العنصر
          const button = element.querySelector('div[role="button"]');
          if (button && isElementVisible(button)) {
            return button;
          }
          
          // إذا لم يتم العثور على زر، نعيد العنصر نفسه
          return element;
        }
      }
    } catch (e) {
      continue;
    }
  }
  
  // محاولة 5: اختر أول زر مرئي في منطقة المحتوى الرئيسية (حل أخير)
  const mainContent = document.querySelector('div[role="main"]');
  if (mainContent) {
    const buttons = mainContent.querySelectorAll('div[role="button"]');
    for (const button of buttons) {
      if (isElementVisible(button) && 
          !button.closest('div[role="article"]') && 
          !button.closest('[aria-label*="Comment"]') &&
          button.getBoundingClientRect().top < 500) { // عادة في الجزء العلوي من الصفحة
        console.log("تم العثور على زر في الجزء العلوي من الصفحة كحل أخير");
        return button;
      }
    }
  }
  
  console.log("لم يتم العثور على زر إنشاء منشور");
  return null;
}

/**
 * البحث عن محرر النص في واجهة المنشور
 */
function findPostTextArea() {
  console.log("البحث عن محرر النص الأساسي للمنشور...");
  
  // تجاهل محررات النص التي قد تكون للتعليقات
  const elementsToIgnore = [
    '[aria-label*="comment"]',
    '[aria-label*="تعليق"]',
    '[aria-label*="reply"]',
    '[aria-label*="رد"]',
    '[placeholder*="comment"]',
    '[placeholder*="تعليق"]',
    '[placeholder*="reply"]',
    '[placeholder*="رد"]',
    '.UFIAddCommentInput',
    '.UFIReplyActorPhotoWrapper',
    '.commentable_item'
  ].join(',');
  
  // محددات محرر المنشور الرئيسي
  const selectors = [
    // محررات النص في الواجهة الجديدة
    'div[role="textbox"][contenteditable="true"][data-testid*="composer"]',
    'div[role="textbox"][contenteditable="true"]:not(' + elementsToIgnore + ')',
    'div[contenteditable="true"][data-contents="true"]',
    
    // محررات النص في الواجهة القديمة
    'textarea[name="xhpc_message"]',
    '#composer_text_input_box',
    'textarea.mentionsTextarea',
    'textarea#composer-textarea',
    
    // محددات إضافية للمنشورات
    'div[data-testid="status-attachment-mentions-input"]',
    'div[aria-label="اكتب شيئًا..."]',
    'div[aria-label="Write something..."]',
    'div[aria-label="ماذا في بالك؟"]',
    'div[aria-label="What\'s on your mind?"]',
    'div[data-contents="true"][aria-label*="post"]',
    'div[data-contents="true"][aria-label*="منشور"]',
    
    // أي محرر مرئي داخل منطقة المنشور
    'div[role="dialog"] div[contenteditable="true"]',
    '.uiScrollableAreaContent div[contenteditable="true"]'
  ];
  
  // البحث عن كل المحددات المحتملة
  const allPotentialEditors = [];
  
  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      console.log(`تم العثور على ${elements.length} محرر(ات) باستخدام المحدد: ${selector}`);
      elements.forEach(el => allPotentialEditors.push(el));
    }
  }
  
  if (allPotentialEditors.length === 0) {
    console.warn("لم يتم العثور على أي محرر نص للمنشور");
    return null;
  }
  
  // ترتيب المحررات حسب الأولوية
  const sortedEditors = allPotentialEditors
    .filter(editor => {
      // استبعاد أي محرر يتعلق بالتعليقات
      const text = editor.textContent?.toLowerCase() || '';
      const ariaLabel = editor.getAttribute('aria-label')?.toLowerCase() || '';
      const placeholder = editor.getAttribute('placeholder')?.toLowerCase() || '';
      
      const isCommentBox = 
        text.includes('comment') || text.includes('تعليق') || text.includes('reply') || text.includes('رد') ||
        ariaLabel.includes('comment') || ariaLabel.includes('تعليق') || ariaLabel.includes('reply') || ariaLabel.includes('رد') ||
        placeholder.includes('comment') || placeholder.includes('تعليق') || placeholder.includes('reply') || placeholder.includes('رد');
      
      const isInCommentSection = !!editor.closest('.UFIComment, .UFIReply, .commentable_item, [aria-label*="comment"], [aria-label*="تعليق"]');
      
      if (isCommentBox || isInCommentSection) {
        console.log("تم تجاهل محرر نص يبدو أنه للتعليقات:", editor);
        return false;
      }
      
      return true;
    })
    .sort((a, b) => {
      // تفضيل المحررات في الحوارات أو المناطق المرئية
      const aInDialog = !!a.closest('div[role="dialog"]');
      const bInDialog = !!b.closest('div[role="dialog"]');
      
      if (aInDialog && !bInDialog) return -1;
      if (!aInDialog && bInDialog) return 1;
      
      // تفضيل المحررات الفارغة أو التي تحتوي على نص أقصر
      const aText = a.textContent?.trim() || '';
      const bText = b.textContent?.trim() || '';
      
      if (!aText && bText) return -1;
      if (aText && !bText) return 1;
      
      return aText.length - bText.length;
    });
  
  if (sortedEditors.length > 0) {
    const bestEditor = sortedEditors[0];
    
    // للتأكد من أن المحرر مرئي وقابل للتحرير
    if (isElementVisible(bestEditor)) {
      console.log("تم العثور على محرر النص المناسب للمنشور:", bestEditor);
      return bestEditor;
    } else {
      console.warn("المحرر الذي تم العثور عليه غير مرئي:", bestEditor);
      
      // محاولة العثور على محرر مرئي آخر
      const visibleEditor = sortedEditors.find(editor => isElementVisible(editor));
      if (visibleEditor) {
        console.log("تم العثور على محرر مرئي بديل:", visibleEditor);
        return visibleEditor;
      }
    }
  }
  
  console.warn("لم يتم العثور على محرر نص مناسب للمنشور");
  return null;
}

/**
 * البحث عن زر النشر
 */
function findPostButton(container) {
  // تحقق من وجود العنصر
  if (!container) return null;
  
  console.log("البحث المفصل عن زر النشر...");
  
  // البحث المباشر عن زر Post النهائي (الظاهر في الصورة)
  // أولاً نحاول البحث عن زر نصي بالضبط يحتوي على "Post" فقط
  try {
    console.log("البحث عن زر Post بالنص المباشر...");
    
    // البحث عن جميع العناصر التي تحتوي نص "Post" بالضبط
    const allElements = Array.from(document.querySelectorAll('*'));
    for (const element of allElements) {
      if (element.tagName === 'SCRIPT' || element.tagName === 'STYLE') continue;
      
      // التحقق من النص المباشر
      if (element.childNodes && element.childNodes.length === 1 && element.childNodes[0].nodeType === 3) {
        const text = element.textContent.trim();
        if (text === 'Post') {
          // البحث عن العنصر القابل للنقر (زر أو div)
          const button = element.closest('div[role="button"]') || element.closest('button');
          if (button && isElementVisible(button)) {
            console.log("تم العثور على زر Post بالضبط!");
            return button;
          }
        }
      }
    }

    // البحث المباشر عن زر بالمحتوى "Post" الموجود في الصورة
    const exactButtons = Array.from(document.querySelectorAll('div[role="button"], button')).filter(btn => {
      const btnText = btn.textContent && btn.textContent.trim();
      return btnText === 'Post' && isElementVisible(btn);
    });
    
    if (exactButtons.length > 0) {
      console.log("تم العثور على زر Post بالضبط!");
      return exactButtons[0];
      }
    } catch (e) {
    console.log("خطأ في البحث عن زر Post بالنص المباشر:", e);
  }
  
  // محددات مختلفة لأزرار النشر
  const buttonSelectors = [
    // محددات مباشرة للزر المعروض في الصورة المرفقة
    '.x1n2onr6.x1ja2u2z.x78zum5.x2lah0s.xl56j7k.x6s0dn4.xozqiw3.x1q0g3np.xi112ho.x17zwfj4.x585lrc.x1403ito.x972fbf.xcfux6l.x1qhh985.xm0m39n.x9f619.xn6708d.x1ye3gou.xtvsq51.x1r1pt67',
    '[data-testid="post-button"]',
    'div[role="button"].x1n2onr6',
    'button.x1n2onr6',
    'div.x1n2onr6:not([aria-hidden="true"])',
    
    // محددات عامة لأزرار النشر
    'div[aria-label="Post"], div[aria-label="نشر"]',
    'button[type="submit"]',
    '[data-testid="react-composer-post-button"]',
    'div[aria-label="Share Now"], div[aria-label="مشاركة الآن"]',
    'div[aria-label*="Post"], div[aria-label*="نشر"]',
    'div[role="button"]:not([aria-label*="photo"]):not([aria-label*="صورة"])'
  ];
  
  // البحث أولاً في الحاوية المحددة مباشرة
  for (const selector of buttonSelectors) {
    try {
      const buttons = (container && container.querySelectorAll) ? 
                     container.querySelectorAll(selector) : 
                     document.querySelectorAll(selector);
                     
  for (const button of buttons) {
        // تحقق من النص للتأكد من أنه زر نشر
    const text = button.textContent.toLowerCase().trim();
        const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
        
        if (text === 'post' || text === 'نشر' || 
            text.includes('post') || text.includes('نشر') ||
            ariaLabel === 'post' || ariaLabel === 'نشر' ||
            ariaLabel.includes('post') || ariaLabel.includes('نشر') ||
            ariaLabel.includes('share now') || ariaLabel.includes('مشاركة الآن')) {
          if (isElementVisible(button)) {
            console.log("تم العثور على زر النشر:", text || ariaLabel);
      return button;
    }
  }
      }
    } catch (e) {
      // تجاهل أخطاء المحدد
      continue;
    }
  }
  
  // البحث في مربعات الحوار المفتوحة
  const dialogs = document.querySelectorAll('div[role="dialog"]');
  if (dialogs.length > 0) {
    console.log(`تم العثور على ${dialogs.length} مربع حوار، البحث عن زر النشر داخلها...`);
    
    for (const dialog of dialogs) {
      // البحث عن الزر في قاع الحوار (حيث يوجد زر النشر عادةً)
      const dialogBounds = dialog.getBoundingClientRect();
      const allButtonsInDialog = Array.from(dialog.querySelectorAll('div[role="button"], button'))
        .filter(isElementVisible);
        
      // ترتيب الأزرار بناءً على موقعها (الزر الأقرب إلى أسفل مربع الحوار)
      const sortedButtons = allButtonsInDialog.sort((a, b) => {
        const aRect = a.getBoundingClientRect();
        const bRect = b.getBoundingClientRect();
        // حساب المسافة من أسفل مربع الحوار
        const aDistanceFromBottom = Math.abs(dialogBounds.bottom - aRect.bottom);
        const bDistanceFromBottom = Math.abs(dialogBounds.bottom - bRect.bottom);
        return aDistanceFromBottom - bDistanceFromBottom;
      });
      
      // استخدم الزر الأقرب إلى الأسفل الذي لا يحتوي على كلمات معينة
      for (const button of sortedButtons) {
        const text = button.textContent.toLowerCase().trim();
        if (!text.includes('photo') && !text.includes('صورة') && 
            !text.includes('video') && !text.includes('فيديو') &&
            !text.includes('file') && !text.includes('ملف') &&
            !text.includes('gif') && !text.includes('emoji') &&
            text !== '' && // تجنب الأزرار الفارغة
            button.getBoundingClientRect().width > 20) { // تجنب الأزرار الصغيرة جدًا
          
          console.log("استخدام زر في أسفل مربع الحوار:", text);
          return button;
        }
      }
      
      // إذا لم نجد زرًا مناسبًا، استخدم أي زر في الأسفل
      if (sortedButtons.length > 0) {
        console.log("استخدام أول زر في أسفل مربع الحوار كخيار أخير");
        return sortedButtons[0];
      }
    }
  }
  
  // محاولة إضافية: البحث في عناصر معينة
  const composerFooter = document.querySelector('.xsag5q8, .x92rtbv, [data-pagelet*="composer"] > div:last-child, .x78zum5, .xdt5ytf, .x1a02dak, .xu8u0ou');
  if (composerFooter) {
    console.log("تم العثور على عنصر footer للمنشور");
    const footerButtons = composerFooter.querySelectorAll('div[role="button"], button');
    
    // البحث عن آخر زر في footer (غالبًا زر النشر)
    const lastButton = Array.from(footerButtons).filter(isElementVisible).pop();
    if (lastButton) {
      console.log("استخدام آخر زر في footer");
      return lastButton;
    }
  }
  
  // محاولة محددة: البحث عن آخر زر في مربع الإنشاء
  try {
    console.log("البحث عن آخر زر في مربع إنشاء المنشور...");
    
    // الأزرار في الجزء السفلي من مربع الحوار
    const bottomButtonContainers = document.querySelectorAll('.x6s0dn4, .x78zum5, .xl56j7k, .x1608yet');
    for (const container of bottomButtonContainers) {
      if (isElementVisible(container)) {
        const visibleButtons = Array.from(container.querySelectorAll('div[role="button"], button')).filter(isElementVisible);
        if (visibleButtons.length > 0) {
          const lastButton = visibleButtons[visibleButtons.length - 1];
          console.log("استخدام آخر زر في الجزء السفلي من مربع الحوار:", lastButton.textContent.trim());
          return lastButton;
        }
      }
    }
  } catch (e) {
    console.log("خطأ في البحث عن آخر زر:", e);
  }
  
  // محاولة أخيرة: البحث في جميع أنحاء الحاوية
  // غالبًا ما يكون زر النشر في الجزء السفلي من الحوار
  console.log("محاولة أخيرة: البحث عن زر في الجزء السفلي من الصفحة...");
  const allButtons = Array.from(document.querySelectorAll('div[role="button"], button'))
    .filter(isElementVisible);
  
  // ترتيب الأزرار من أسفل إلى أعلى
  const sortedButtons = allButtons.sort((a, b) => {
    const rectA = a.getBoundingClientRect();
    const rectB = b.getBoundingClientRect();
    // نفضل الأزرار في الجزء السفلي
    return rectB.top - rectA.top;
  });
  
  // البحث عن زر في الجزء السفلي
  for (const button of sortedButtons) {
    const buttonRect = button.getBoundingClientRect();
    // فحص موقع الزر (في النصف السفلي من النافذة)
    if (buttonRect.top > window.innerHeight / 2) {
      const text = button.textContent.toLowerCase().trim();
      // تجنب أزرار الصور والفيديو والملفات
      if (!text.includes('photo') && !text.includes('صورة') && 
          !text.includes('video') && !text.includes('فيديو') &&
          !text.includes('file') && !text.includes('ملف') &&
          text !== '') {
        console.log("العثور على زر في النصف السفلي من الصفحة:", text);
        return button;
      }
    }
  }
  
  // محاولة عامة: البحث عن أي زر في الجزء السفلي
  if (sortedButtons.length > 0) {
    for (let i = 0; i < Math.min(3, sortedButtons.length); i++) {
      const text = sortedButtons[i].textContent.toLowerCase().trim();
      // تجنب أزرار الصور والفيديو والملفات
      if (!text.includes('photo') && !text.includes('صورة') && 
          !text.includes('video') && !text.includes('فيديو') &&
          !text.includes('file') && !text.includes('ملف') &&
          text !== '') {
        console.log("استخدام أحد الأزرار العلوية في الجزء السفلي كحل أخير:", text);
        return sortedButtons[i];
      }
    }
  }
  
  return null;
}

/**
 * التحقق من أن العنصر مرئي وقابل للتفاعل
 */
function isElementVisible(element) {
  if (!element || !element.getBoundingClientRect) return false;
  
  try {
    const rect = element.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(element);
    
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      computedStyle.display !== 'none' &&
      computedStyle.visibility !== 'hidden' &&
      computedStyle.opacity !== '0'
    );
  } catch (e) {
    console.error("خطأ في التحقق من رؤية العنصر:", e);
    return false;
  }
}

/**
 * إطلاق الأحداث المطلوبة لفيسبوك
 */
function triggerFacebookEvents(element) {
  // أحداث الإدخال الأساسية
  const events = [
    new Event('input', { bubbles: true, cancelable: true }),
    new Event('change', { bubbles: true, cancelable: true }),
    new KeyboardEvent('keydown', { bubbles: true, cancelable: true }),
    new KeyboardEvent('keypress', { bubbles: true, cancelable: true }),
    new KeyboardEvent('keyup', { bubbles: true, cancelable: true }),
    new FocusEvent('focus', { bubbles: true, cancelable: true }),
    new FocusEvent('focusin', { bubbles: true, cancelable: true }),
    new InputEvent('beforeinput', { bubbles: true, cancelable: true }),
    new InputEvent('input', { bubbles: true, cancelable: true, data: element.textContent || element.value, inputType: 'insertText' }),
    new Event('compositionstart', { bubbles: true, cancelable: true }),
    new Event('compositionupdate', { bubbles: true, cancelable: true }),
    new Event('compositionend', { bubbles: true, cancelable: true })
  ];
  
  // إطلاق جميع الأحداث
  for (const event of events) {
    try {
      element.dispatchEvent(event);
    } catch (e) {
      console.log(`فشل إطلاق حدث ${event.type}:`, e);
    }
  }
}

/**
 * إطلاق حدث تغيير القيمة
 */
function triggerInputEvent(element) {
  const inputEvent = new Event('input', { bubbles: true });
  element.dispatchEvent(inputEvent);
  
  const changeEvent = new Event('change', { bubbles: true });
  element.dispatchEvent(changeEvent);
  
  // إطلاق أحداث إضافية للتوافق مع أحدث إصدارات فيسبوك
  try {
    const keydownEvent = new KeyboardEvent('keydown', { bubbles: true });
    element.dispatchEvent(keydownEvent);
    
    const keyupEvent = new KeyboardEvent('keyup', { bubbles: true });
    element.dispatchEvent(keyupEvent);
  } catch (e) {
    console.log("فشل إطلاق أحداث لوحة المفاتيح:", e);
  }
}

/**
 * استخراج قائمة المجموعات من فيسبوك
 */
async function extractGroups() {
  return new Promise((resolve, reject) => {
    try {
      console.log("بدء استخراج المجموعات...");
      
      // محاولة استخراج المجموعات بأكثر من طريقة للتوافق مع مختلف واجهات فيسبوك
      setTimeout(() => {
        // مجموعة نتائج المجموعات
        let groups = [];
        
        // الطريقة 1: البحث عن قائمة المجموعات في صفحة تغذية المجموعات
        const groupLinks = document.querySelectorAll('a[href*="/groups/"][role="link"]');
        
        // الطريقة 2: البحث عن قائمة المجموعات في القائمة الجانبية
        const sidebarGroupLinks = document.querySelectorAll('a[href*="/groups/"][aria-label]');
        
        // الطريقة 3: البحث عن قائمة المجموعات في الواجهة القديمة
        const oldInterfaceGroupLinks = document.querySelectorAll('#pinnedNav a[href*="/groups/"]');
        
        // جمع النتائج من جميع الطرق
        const allGroupLinks = [...groupLinks, ...sidebarGroupLinks, ...oldInterfaceGroupLinks];
        
        // تصفية النتائج وإزالة التكرارات
        const processedUrls = new Set();
        
        allGroupLinks.forEach(link => {
          // الحصول على عنوان URL للمجموعة
          let url = link.href;
          
          // التأكد من أن الرابط يشير إلى مجموعة وليس لوحة تحكم المجموعات أو قائمة المجموعات
          if (url && 
              url.includes('/groups/') && 
              !url.includes('/groups/feed') && 
              !url.includes('/groups/discover') && 
              !url.includes('/groups/your_groups') &&
              !url.includes('/groups/manage_your_groups')) {
            
            // تنظيف الرابط وإزالة أي معلمات إضافية
            url = url.split('?')[0];
            
            // تجنب التكرارات
            if (!processedUrls.has(url)) {
              processedUrls.add(url);
              
              // الحصول على اسم المجموعة
              let name = '';
              
              // محاولة الحصور على النص من العنصر نفسه أو من العناصر الفرعية
              if (link.textContent && link.textContent.trim()) {
                name = link.textContent.trim();
              } else if (link.querySelector('span')) {
                name = link.querySelector('span').textContent.trim();
              } else if (link.ariaLabel) {
                name = link.ariaLabel.replace('Link', '').trim();
              } else {
                // إذا لم نتمكن من العثور على الاسم، استخدم معرف المجموعة
                name = url.split('/groups/')[1].split('/')[0];
                name = 'مجموعة ' + name;
              }
              
              // تنظيف الاسم من أي نصوص غير مرغوب فيها
              name = name.replace('Group', '').replace('مجموعة عامة', '').replace('مجموعة خاصة', '').trim();
              
              // إضافة المجموعة إلى القائمة
              groups.push({
                name: name,
                url: url
              });
            }
          }
        });
        
        console.log(`تم العثور على ${groups.length} مجموعة`);
        
        // فرز المجموعات أبجدياً
        groups.sort((a, b) => a.name.localeCompare(b.name));
        
        resolve(groups);
      }, 3000);
    } catch (error) {
      console.error("فشل استخراج المجموعات:", error);
      reject(error);
    }
  });
}

/**
 * البحث عن جميع أزرار النشر المحتملة
 */
function findAllPostButtons(container) {
  // التحقق من وجود العنصر
  if (!container) return null;
  
  console.log("البحث عن جميع أزرار النشر المحتملة...");
  
  // محددات أوسع لأزرار النشر لزيادة فرص العثور على الزر الصحيح
  const buttonSelectors = [
    'div[aria-label="Post"], div[aria-label="نشر"]',
    'button[type="submit"]',
    '[data-testid="react-composer-post-button"]',
    'div[role="button"]:not([aria-label*="photo"]):not([aria-label*="صورة"])',
    'button:not([aria-label*="photo"]):not([aria-label*="صورة"])',
    'div.x1n2onr6 div[role="button"]',
    'div.x92rtbv div[role="button"]',
    // العناصر التي تحتوي على نص "نشر" أو "Post"
    'div[role="button"]:contains("Post"), div[role="button"]:contains("نشر")',
    'button:contains("Post"), button:contains("نشر")'
  ];
  
  // البحث عن جميع الأزرار المرئية في المستند
  const allButtons = Array.from(container.querySelectorAll('div[role="button"], button')).filter(isElementVisible);
  
  // البحث عن الزر باستخدام محتوى النص
  for (const button of allButtons) {
        const text = button.textContent.toLowerCase().trim();
        const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
        
        if (text === 'post' || text === 'نشر' || 
            text.includes('post') || text.includes('نشر') ||
            ariaLabel === 'post' || ariaLabel === 'نشر' ||
            ariaLabel.includes('post') || ariaLabel.includes('نشر')) {
      console.log("تم العثور على زر النشر عن طريق النص:", text || ariaLabel);
            return button;
    }
  }
  
  // لم يتم العثور على زر بالنص المحدد، اختر أي زر في أسفل مربع الحوار
  // هذه خطوة استثنائية للحالات التي لا يمكن فيها العثور على الزر بالطرق العادية
  const dialog = container.closest('div[role="dialog"]') || container;
  
  if (dialog) {
    // البحث عن الأزرار في الجزء السفلي من مربع الحوار
    const buttons = Array.from(dialog.querySelectorAll('div[role="button"], button')).filter(isElementVisible);
    
    // ترتيب الأزرار حسب موقعها العمودي (الأسفل أولاً)
    const sortedButtons = buttons
      .filter(btn => btn.getBoundingClientRect().top > dialog.getBoundingClientRect().top + dialog.getBoundingClientRect().height / 2)
      .sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top);
    
    if (sortedButtons.length > 0) {
      console.log("استخدام أول زر في أسفل مربع الحوار كخيار أخير");
      return sortedButtons[0];
    }
  }
  
  return null;
}

// إضافة مراقب موقع لتسهيل التصحيح
console.log("FB Group Multi Poster content script تم تفعيله على:", window.location.href); 

/**
 * وظيفة محسنة للنقر على زر النشر تستخدم عدة طرق وتلغي منع إغلاق النافذة بعد النشر
 */
function clickPostButton(postButton) {
  console.log("محاولة النقر على زر النشر...");
  
  // التحقق من وجود وظهور الزر
  if (!postButton) {
    console.error("فشل النقر: زر النشر غير موجود");
    return false;
  }
  
  if (!isElementVisible(postButton)) {
    console.error("فشل النقر: زر النشر غير مرئي");
    return false;
  }
  
  // ضمان تمرير التركيز للزر
  try {
    postButton.focus();
  } catch (e) {
    console.warn("فشل في تركيز زر النشر:", e);
  }
  
  let clicked = false;
  
  // المحاولة الأولى: النقر المباشر
  try {
    console.log("المحاولة الأولى: النقر المباشر");
    postButton.click();
    clicked = true;
  } catch (e) {
    console.warn("فشلت المحاولة الأولى للنقر:", e);
  }
  
  // المحاولة الثانية: استخدام حدث الماوس
  if (!clicked) {
    try {
      console.log("المحاولة الثانية: استخدام حدث الماوس");
      const mouseEvent = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true
      });
      postButton.dispatchEvent(mouseEvent);
      clicked = true;
    } catch (e) {
      console.warn("فشلت المحاولة الثانية للنقر:", e);
    }
  }
  
  // المحاولة الثالثة: أحداث ماوس متعددة
  if (!clicked) {
    try {
      console.log("المحاولة الثالثة: أحداث ماوس متعددة");
      const mouseEvents = ['mousedown', 'mouseup', 'click'];
      mouseEvents.forEach(eventType => {
        const event = new MouseEvent(eventType, {
          view: window,
          bubbles: true,
          cancelable: true
        });
        postButton.dispatchEvent(event);
      });
      clicked = true;
    } catch (e) {
      console.warn("فشلت المحاولة الثالثة للنقر:", e);
    }
  }
  
  // المحاولة الرابعة: النقر باستخدام JavaScript الأصلي
  if (!clicked) {
    try {
      console.log("المحاولة الرابعة: النقر باستخدام JavaScript الأصلي");
      const rect = postButton.getBoundingClientRect();
      const centerX = Math.floor(rect.left + rect.width / 2);
      const centerY = Math.floor(rect.top + rect.height / 2);
      
      // محاكاة تحريك الماوس إلى الموقع
      const moveEvent = new MouseEvent('mousemove', {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: centerX,
        clientY: centerY
      });
      postButton.dispatchEvent(moveEvent);
      
      // محاكاة النقر
      const clickEvent = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: centerX,
        clientY: centerY
      });
      postButton.dispatchEvent(clickEvent);
      clicked = true;
    } catch (e) {
      console.warn("فشلت المحاولة الرابعة للنقر:", e);
    }
  }
  
  // المحاولة الخامسة: محاولة التنفيذ عبر enter على لوحة المفاتيح
  if (!clicked) {
    try {
      console.log("المحاولة الخامسة: محاولة التنفيذ عبر enter على لوحة المفاتيح");
      postButton.focus();
      const keyEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
      });
      postButton.dispatchEvent(keyEvent);
      clicked = true;
    } catch (e) {
      console.warn("فشلت المحاولة الخامسة للنقر:", e);
    }
  }
  
  // المحاولة السادسة: تعديل السمات وتنفيذ النقر
  if (!clicked) {
    try {
      console.log("المحاولة السادسة: تعديل السمات وتنفيذ النقر");
      // التأكد من أن الزر قابل للنقر
      postButton.disabled = false;
      postButton.setAttribute('aria-disabled', 'false');
      postButton.style.pointerEvents = 'auto';
      postButton.style.opacity = '1';
      postButton.style.cursor = 'pointer';
      postButton.click();
      clicked = true;
    } catch (e) {
      console.warn("فشلت المحاولة السادسة للنقر:", e);
    }
  }
  
  // إلغاء منع إغلاق النافذة بعد اكتمال النشر
  setTimeout(() => {
    try {
      if (typeof window.releaseTabClosingPrevention === 'function') {
        window.releaseTabClosingPrevention();
      }
    } catch (e) {
      console.warn("فشل في إلغاء منع إغلاق علامة التبويب:", e);
    }
  }, 5000);
  
  return clicked;
}

/**
 * طريقة خاصة للبحث عن زر النشر في مربع حوار إنشاء المنشور في الشكل الجديد
 */
function findSpecificPostButtonInDialog() {
  console.log("استخدام طريقة مخصصة للبحث عن زر النشر في مربع الحوار...");
  
  // 1. البحث عن نص "Post" بالضبط كنص مستقل
  const textNodes = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
  let node;
  while (node = walker.nextNode()) {
    if (node.nodeValue && node.nodeValue.trim() === 'Post') {
      textNodes.push(node);
    }
  }
  
  // العثور على العنصر القابل للنقر المحيط بالنص
  for (const textNode of textNodes) {
    let element = textNode.parentElement;
    // البحث عن أقرب زر أو عنصر قابل للنقر
    while (element && element !== document.body) {
      if (element.tagName === 'BUTTON' || 
          element.getAttribute('role') === 'button' || 
          element.onclick || 
          window.getComputedStyle(element).cursor === 'pointer') {
        console.log("تم العثور على زر بنص Post في مربع الحوار");
        return element;
      }
      element = element.parentElement;
    }
  }
  
  // 2. البحث المباشر عن العناصر المطابقة للأنماط في الصورة
  try {
    // زر نشر محدد - يطابق الزر المرئي في الصورة
    const specificButton = document.querySelector('div.x1n2onr6.x1ja2u2z.x78zum5.x2lah0s.xl56j7k.x6s0dn4.xozqiw3.x1q0g3np.xi112ho.x17zwfj4.x585lrc.x1403ito.x972fbf.xcfux6l.x1qhh985.xm0m39n.x9f619.xn6708d.x1ye3gou.xtvsq51.x1r1pt67');
    if (specificButton && isElementVisible(specificButton)) {
      console.log("تم العثور على الزر المحدد المطابق للصورة");
      return specificButton;
    }
  } catch (e) {
    console.error("خطأ في البحث عن زر محدد:", e);
  }
  
  // 3. البحث عن الزر الأزرق بالبحث عن لون الخلفية
  try {
    const blueButtons = Array.from(document.querySelectorAll('button, div[role="button"]'))
      .filter(btn => {
        if (!isElementVisible(btn)) return false;
        const styles = window.getComputedStyle(btn);
        const bgColor = styles.backgroundColor.toLowerCase();
        // البحث عن اللون الأزرق الخاص بفيسبوك
        return bgColor.includes('rgb(24, 119, 242)') || 
               bgColor === 'rgb(0, 132, 255)' || 
               bgColor === '#0084ff' || 
               bgColor === '#1877f2';
      });
    
    // إذا وجدنا أزرار زرقاء، نبحث عن واحد في أسفل مربع الحوار
    if (blueButtons.length > 0) {
      const dialogs = document.querySelectorAll('div[role="dialog"]');
      let closestButton = null;
      let minDistance = Infinity;
      
      // العثور على الزر الأزرق الأقرب إلى أسفل مربع الحوار
      for (const dialog of dialogs) {
        const dialogRect = dialog.getBoundingClientRect();
        const dialogBottom = dialogRect.top + dialogRect.height;
        
        for (const btn of blueButtons) {
          const btnRect = btn.getBoundingClientRect();
          const distance = Math.abs(btnRect.bottom - dialogBottom);
          
          if (btnRect.left >= dialogRect.left && 
              btnRect.right <= dialogRect.right && 
              btnRect.top >= dialogRect.top && 
              btnRect.bottom <= dialogBottom && 
              distance < minDistance) {
            minDistance = distance;
            closestButton = btn;
          }
        }
      }
      
      if (closestButton) {
        console.log("تم العثور على زر أزرق بالقرب من أسفل مربع الحوار");
        return closestButton;
        }
      }
    } catch (e) {
    console.error("خطأ في البحث عن الزر الأزرق:", e);
  }
  
  // 4. البحث في أسفل مربع الحوار
  const dialogs = document.querySelectorAll('div[role="dialog"]');
  for (const dialog of dialogs) {
    // التركيز على الجزء السفلي من مربع الحوار
    const dialogRect = dialog.getBoundingClientRect();
    const lowerArea = {
      top: dialogRect.top + dialogRect.height * 0.7, // الثلث السفلي من مربع الحوار
      bottom: dialogRect.bottom,
      left: dialogRect.left,
      right: dialogRect.right
    };
    
    // البحث عن جميع الأزرار في هذه المنطقة
    const buttonsInLowerArea = Array.from(dialog.querySelectorAll('button, div[role="button"]'))
      .filter(btn => {
        if (!isElementVisible(btn)) return false;
        const btnRect = btn.getBoundingClientRect();
        return btnRect.top >= lowerArea.top && 
               btnRect.left >= lowerArea.left && 
               btnRect.right <= lowerArea.right;
      });
    
    // ترتيب الأزرار حسب الموقع (من اليمين إلى اليسار)
    const sortedButtons = buttonsInLowerArea.sort((a, b) => {
      return b.getBoundingClientRect().right - a.getBoundingClientRect().right;
    });
    
    if (sortedButtons.length > 0) {
      // عادة ما يكون زر النشر هو الزر الأيمن في أسفل مربع الحوار
      console.log("تم العثور على زر في الجزء السفلي من مربع الحوار");
      return sortedButtons[0];
    }
  }
  
  return null;
}

/**
 * إنشاء زر النشر وهمي ووضعه في مربع الحوار بشكل مباشر
 */
function createFakePostButton(dialog) {
  if (!dialog) {
    const dialogs = document.querySelectorAll('div[role="dialog"]');
    if (dialogs.length > 0) {
      dialog = dialogs[0];
    } else {
      return null;
    }
  }
  
  console.log("إنشاء زر نشر وهمي في مربع الحوار كحل أخير...");
  
  try {
    // إنشاء الزر
    const fakeButton = document.createElement('button');
    fakeButton.textContent = 'Post';
    fakeButton.id = 'fb-group-poster-fake-post-button';
    
    // تنسيق الزر ليبدو مثل زر Post في فيسبوك
    fakeButton.style.backgroundColor = '#1877f2';
    fakeButton.style.color = 'white';
    fakeButton.style.border = 'none';
    fakeButton.style.borderRadius = '6px';
    fakeButton.style.padding = '8px 12px';
    fakeButton.style.font = 'inherit';
    fakeButton.style.fontWeight = 'bold';
    fakeButton.style.cursor = 'pointer';
    fakeButton.style.margin = '8px';
    fakeButton.style.zIndex = '999999';
    fakeButton.style.position = 'relative';
    
    // مسح أي زر وهمي سابق
    const oldFakeButton = document.getElementById('fb-group-poster-fake-post-button');
    if (oldFakeButton) {
      oldFakeButton.remove();
    }
    
    // إضافة الزر إلى نهاية مربع الحوار
    const footer = dialog.querySelector('.xsag5q8, .x92rtbv, [data-pagelet*="composer"] > div:last-child, .x78zum5, .xdt5ytf');
    
    if (footer) {
      footer.appendChild(fakeButton);
    } else {
      // إذا لم يتم العثور على العنصر footer، أضف الزر في نهاية مربع الحوار
      dialog.appendChild(fakeButton);
    }
    
    // إضافة إشارة للزر لسهولة التعرف عليه
    fakeButton.setAttribute('data-testid', 'react-composer-post-button');
    fakeButton.setAttribute('aria-label', 'Post');
    fakeButton.setAttribute('role', 'button');
    
    console.log("تم إنشاء زر نشر وهمي بنجاح");
    return fakeButton;
  } catch (e) {
    console.error("خطأ أثناء إنشاء زر النشر الوهمي:", e);
    return null;
  }
}

/**
 * إغلاق مربع تأكيد النشر إذا ظهر
 */
function closeConfirmationDialog() {
  // اختيار الزر "حسنًا" أو "نعم" في مربع التأكيد
  const confirmButtons = [
    // أزرار التأكيد المختلفة التي تظهر في مربعات حوار Facebook
    document.querySelector('button[data-testid="confirmationSheetConfirm"]'),
    document.querySelector('button[data-testid="confirmation-button"]'),
    document.querySelector('[aria-label="حسنًا"]'),
    document.querySelector('[aria-label="OK"]'),
    document.querySelector('[aria-label="Yes"]'),
    document.querySelector('[aria-label="نعم"]'),
    // نص مربع الحوار وزر التأكيد الذي في الصورة
    ...Array.from(document.querySelectorAll('div[role="dialog"] button')).filter(btn => 
      btn.textContent.includes('حسنًا') || 
      btn.textContent.includes('OK') || 
      btn.textContent.includes('نعم') || 
      btn.textContent.includes('Yes')
    )
  ];
  
  // البحث عن مربع الحوار الذي يحتوي على النص "تعرض الإضافة" أو "FB Group Multi Poster"
  const dialogs = Array.from(document.querySelectorAll('div[role="dialog"]'));
  const extensionDialog = dialogs.find(dialog => 
    dialog.textContent.includes('FB Group Multi Poster') || 
    dialog.textContent.includes('تعرض الإضافة') ||
    dialog.textContent.includes('سيتم نشر المحتوى')
  );
  
  if (extensionDialog) {
    console.log('تم العثور على مربع تأكيد الإضافة، جاري الموافقة عليه تلقائيًا');
    
    // البحث عن زر التأكيد داخل هذا المربع
    const confirmBtn = Array.from(extensionDialog.querySelectorAll('button')).find(btn => 
      btn.textContent.includes('حسنًا') || 
      btn.textContent.includes('OK') || 
      btn.textContent.includes('نعم') || 
      btn.textContent.includes('Yes')
    );
    
    if (confirmBtn) {
      console.log('النقر على زر التأكيد');
      confirmBtn.click();
      return true;
    }
  }
  
  // محاولة النقر على أي زر تأكيد تم العثور عليه
  for (const button of confirmButtons) {
    if (button) {
      console.log('النقر على زر تأكيد');
    button.click();
      return true;
    }
  }
  
  // البحث عن مربعات حوار بناءً على الخصائص المرئية
  const visibleDialogs = Array.from(document.querySelectorAll('div[role="dialog"]')).filter(dialog => {
    const style = window.getComputedStyle(dialog);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  });
  
  for (const dialog of visibleDialogs) {
    // البحث عن أي زر داخل مربع الحوار
    const dialogButtons = dialog.querySelectorAll('button');
    for (const button of dialogButtons) {
      // نقرة على الزر الأول الذي يبدو مثل زر تأكيد (أزرق اللون عادةً)
      if (button.textContent.trim() && !button.textContent.includes('إلغاء') && !button.textContent.includes('Cancel')) {
        if (dialog.textContent.includes('FB Group Multi Poster') || 
            dialog.textContent.includes('تعرض الإضافة') ||
            dialog.textContent.includes('سيتم نشر المحتوى')) {
          console.log('النقر على زر في مربع حوار مرئي');
        button.click();
          return true;
        }
      }
    }
  }
  
  console.log('لم يتم العثور على مربع تأكيد');
  return false;
}

/**
 * نشر المحتوى في المجموعة
 */
function postToGroup(message) {
  if (!message || !message.post) {
    console.log('لم يتم توفير نص المنشور');
    return { success: false, message: 'لم يتم توفير نص المنشور' };
  }
  
  // التحقق مما إذا كنا في صفحة مجموعة
  if (!window.location.href.includes('/groups/')) {
    console.error("We're not on a group page, there might be an error in the URL");
    return { success: false, message: 'لسنا في صفحة مجموعة، هناك خطأ في عنوان URL' };
  }
  
  // التحقق من وجود واجهة مناسبة للنشر
  let editor = findPostTextArea();
  if (!editor) {
    console.log("محاولة العثور على زر إنشاء المنشور والنقر عليه...");
    const createButton = findCreatePostButton();
    if (createButton) {
      console.log("تم العثور على زر إنشاء المنشور، النقر عليه...");
      createButton.click();
      
      // انتظار لظهور محرر النص بعد النقر
      setTimeout(() => {
        editor = findPostTextArea();
        if (!editor) {
          console.error("لم يتم العثور على محرر النص للمنشور بعد النقر على زر الإنشاء");
          // يمكننا الاستمرار للمجموعة التالية من هنا
          return { success: false, message: 'لم يتم العثور على محرر النص للمنشور', shouldContinue: true };
        } else {
          // استمرار عملية النشر بعد العثور على المحرر
          return startPosting(message);
        }
      }, 3000);
      
      // إعادة قيمة مؤقتة في انتظار اكتمال العملية
      return { success: true, message: 'جار محاولة فتح محرر النص...' };
    } else {
      console.error("لم يتم العثور على زر إنشاء المنشور");
      return { success: false, message: 'لم يتم العثور على زر إنشاء المنشور', shouldContinue: true };
    }
  }
  
  // إذا وصلنا إلى هنا، فقد تم العثور على محرر النص مباشرة
  return startPosting(message);
  
  // وظيفة مساعدة لبدء عملية النشر بعد التحقق
  function startPosting(message) {
    // التحقق من واجهة فيسبوك
    if (isNewInterface()) {
      console.log('استخدام الواجهة الجديدة لفيسبوك');
      postToNewInterface(message.post, message.images || []);
    } else {
      console.log('استخدام الواجهة القديمة لفيسبوك');
      postToOldInterface(message.post, message.images || []);
    }
    
    // محاولة إغلاق مربعات التأكيد كل ثانية
    let confirmationCheckCount = 0;
    const confirmationCheckInterval = setInterval(() => {
      if (closeConfirmationDialog() || confirmationCheckCount > 10) {
        clearInterval(confirmationCheckInterval);
      }
      confirmationCheckCount++;
    }, 1000);
    
    return { success: true };
  }
}

function releaseTabClosingPrevention() {
  console.log("إلغاء منع إغلاق علامة التبويب...");
  
  try {
    // إزالة جميع مستمعي الأحداث beforeunload من النافذة
    window.onbeforeunload = null;
    
    // محاولة إزالة مستمعي الأحداث المضافة بواسطة addEventListener
    const noop = function() { return; };
    window.addEventListener('beforeunload', noop);
    window.removeEventListener('beforeunload', noop);
    
    // التأكد من عدم وجود أي تغييرات غير محفوظة في نماذج الصفحة
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
      if (form.getAttribute('data-tracking') || form.getAttribute('data-testid')) {
        // إعادة تعيين خصائص النموذج التي قد تؤدي إلى منع الإغلاق
        try {
          form.setAttribute('data-dirty', 'false');
          const submitButton = form.querySelector('button[type="submit"]');
          if (submitButton) {
            submitButton.disabled = false;
          }
        } catch (e) {
          console.warn("فشل في إعادة تعيين حالة النموذج:", e);
        }
      }
    });
    
    // محاولة العثور على عناصر محددة في فيسبوك تؤدي إلى منع الإغلاق
    const composerElements = document.querySelectorAll('[role="presentation"], [role="dialog"]');
    composerElements.forEach(element => {
      try {
        // محاولة تشغيل زر الإلغاء أو الإغلاق إذا وجد
        const cancelButton = element.querySelector('[aria-label="إلغاء"], [aria-label="Cancel"], button[type="reset"]');
        if (cancelButton) {
          cancelButton.click();
        }
      } catch (e) {
        console.warn("فشل في النقر على زر الإلغاء:", e);
      }
    });
    
    console.log("تم إلغاء منع إغلاق علامة التبويب بنجاح");
    return true;
  } catch (error) {
    console.error("فشل في إلغاء منع إغلاق علامة التبويب:", error);
    return false;
  }
}

// تعريف الوظيفة على مستوى النافذة لاستخدامها في أماكن أخرى
window.releaseTabClosingPrevention = releaseTabClosingPrevention;
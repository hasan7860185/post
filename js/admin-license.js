/**
 * نظام إدارة التراخيص - لوحة المسؤول
 */

// المتغيرات العامة - استخدم نفس معرف Gist المستخدم في license.js
const GIST_ID = '234b3837c2ca95e54c68c55a8bfd0e3c'; // استبدل هذا بمعرف Gist الخاص بك
// لا تحتفظ بتوكن GitHub في كود مفتوح - استخدم طريقة آمنة للتخزين
// في هذا المثال، سنستخدم توكن افتراضي للتجربة فقط - قم بتغييره
const GITHUB_TOKEN = ''; // سنطلب من المستخدم إدخال التوكن

// التحقق من وجود واجهة التخزين المحلي
function setupLocalStorage() {
  if (typeof localStorage === 'undefined') {
    console.log('محاكاة التخزين المحلي');
    window.localStorage = {
      getItem: function(key) {
        return this[key] || null;
      },
      setItem: function(key, value) {
        this[key] = value;
      },
      removeItem: function(key) {
        delete this[key];
      }
    };
  }
}

// تنفيذ إعداد التخزين المحلي
setupLocalStorage();

document.addEventListener('DOMContentLoaded', function() {
  console.log('تم تحميل صفحة إدارة التراخيص');
  
  // المراجع للعناصر
  const licenseForm = document.getElementById('license-form');
  const refreshBtn = document.getElementById('refresh-btn');
  const messageContainer = document.getElementById('message-container');
  const loadingIndicator = document.getElementById('loading');
  
  // التحقق من وجود توكن GitHub محفوظ محلياً
  const savedToken = localStorage.getItem('github_token');
  if (savedToken) {
    console.log('تم العثور على توكن GitHub محفوظ');
  } else {
    // طلب التوكن من المستخدم
    promptForGithubToken();
  }
  
  // تحميل قائمة التراخيص عند فتح الصفحة
  loadLicenses();
  
  // إضافة مستمع حدث للنموذج لإنشاء ترخيص جديد
  licenseForm.addEventListener('submit', function(e) {
    e.preventDefault();
    createNewLicense();
  });
  
  // إضافة مستمع حدث لزر التحديث
  refreshBtn.addEventListener('click', function() {
    loadLicenses();
  });
  
  /**
   * طلب توكن GitHub من المستخدم
   */
  function promptForGithubToken() {
    const token = prompt('يرجى إدخال توكن GitHub الخاص بك للوصول إلى التراخيص:');
    if (token) {
      localStorage.setItem('github_token', token);
      showMessage('تم حفظ التوكن بنجاح', 'success');
    } else {
      showMessage('لم يتم إدخال توكن GitHub، ستكون بعض الوظائف محدودة', 'error');
    }
  }
  
  /**
   * الحصول على توكن GitHub المحفوظ
   */
  function getGithubToken() {
    const token = localStorage.getItem('github_token') || GITHUB_TOKEN;
    if (!token) {
      showMessage('لم يتم العثور على توكن GitHub. بعض الوظائف قد لا تعمل.', 'error');
    }
    return token;
  }
  
  /**
   * تحميل قائمة التراخيص من GitHub Gist أو الملف المحلي
   */
  function loadLicenses() {
    showLoading(true);
    console.log('جاري تحميل التراخيص');
    
    // محاولة استخدام الـ Gist أولاً
    const token = getGithubToken();
    
    if (token) {
      // استخدام GitHub Gist
      console.log('استخدام GitHub Gist للتراخيص');
      fetch(`https://api.github.com/gists/${GIST_ID}`, {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      })
      .then(response => {
        console.log('استجابة الخادم:', response.status);
        if (!response.ok) {
          throw new Error(`فشل في الاتصال بالخادم: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        try {
          console.log('تم استلام البيانات من GitHub');
          
          const licenseFile = data.files['licenses.json'];
          if (!licenseFile) {
            throw new Error('ملف التراخيص غير موجود');
          }
          
          const licenses = JSON.parse(licenseFile.content);
          renderLicensesList(licenses);
          showMessage('تم تحميل بيانات التراخيص بنجاح.', 'success');
        } catch (error) {
          console.error('خطأ في معالجة بيانات الترخيص:', error);
          showMessage('حدث خطأ في تحميل بيانات التراخيص: ' + error.message, 'error');
          
          // محاولة استخدام الملف المحلي كخطة بديلة
          loadLocalLicenses();
        }
      })
      .catch(error => {
        console.error('خطأ في تحميل التراخيص من GitHub:', error);
        showMessage('فشل الاتصال بالخادم. يرجى المحاولة لاحقًا أو استخدام الملف المحلي.', 'error');
        
        // محاولة استخدام الملف المحلي كخطة بديلة
        loadLocalLicenses();
      })
      .finally(() => {
        showLoading(false);
      });
    } else {
      // استخدام الملف المحلي
      loadLocalLicenses();
    }
  }
  
  /**
   * تحميل التراخيص من الملف المحلي
   */
  function loadLocalLicenses() {
    console.log('محاولة تحميل التراخيص من الملف المحلي');
    
    fetch('../licenses.json')
      .then(response => {
        if (!response.ok) {
          throw new Error('فشل في تحميل ملف التراخيص المحلي');
        }
        return response.json();
      })
      .then(licenses => {
        renderLicensesList(licenses);
        showMessage('تم تحميل بيانات التراخيص من الملف المحلي.', 'success');
      })
      .catch(error => {
        console.error('خطأ في تحميل التراخيص من الملف المحلي:', error);
        showMessage('تعذر تحميل التراخيص. يرجى التحقق من اتصالك بالإنترنت أو ملف التراخيص المحلي.', 'error');
        
        // عرض نموذج فارغ على الأقل
        renderLicensesList([]);
      })
      .finally(() => {
        showLoading(false);
      });
  }
  
  /**
   * عرض قائمة التراخيص في الجدول
   */
  function renderLicensesList(licenses) {
    const licensesList = document.getElementById('licenses-list');
    licensesList.innerHTML = '';
    
    console.log('عرض قائمة التراخيص، العدد:', licenses.length);
    
    if (licenses.length === 0) {
      licensesList.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center;">لا توجد تراخيص حتى الآن</td>
        </tr>
      `;
      return;
    }
    
    // ترتيب التراخيص حسب تاريخ الإنشاء (الأحدث أولًا)
    licenses.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    licenses.forEach(license => {
      const now = new Date();
      const expiryDate = new Date(license.expiry);
      
      let status = '';
      if (license.revoked) {
        status = '<span class="status-revoked">ملغي</span>';
      } else if (expiryDate < now) {
        status = '<span class="status-expired">منتهي</span>';
      } else {
        status = '<span class="status-active">نشط</span>';
      }
      
      // تنسيق التاريخ بشكل أفضل
      const createdDate = formatDate(new Date(license.createdAt));
      const expiryDateFormatted = formatDate(new Date(license.expiry));
      
      const row = document.createElement('tr');
      row.innerHTML = `
        <td class="license-key">${license.key}</td>
        <td>${license.name}</td>
        <td>${license.email}</td>
        <td>${createdDate}</td>
        <td>${expiryDateFormatted}</td>
        <td>${status}</td>
        <td>
          ${!license.revoked ? 
            `<button class="btn btn-danger btn-sm action-btn revoke-btn" data-key="${license.key}">إلغاء</button>` : 
            `<button class="btn btn-success btn-sm action-btn restore-btn" data-key="${license.key}">استعادة</button>`
          }
          <button class="btn btn-outline-danger btn-sm action-btn delete-btn" data-key="${license.key}">حذف</button>
          <button class="btn btn-outline-primary btn-sm action-btn copy-btn" data-key="${license.key}">نسخ</button>
        </td>
      `;
      
      licensesList.appendChild(row);
    });
    
    // إضافة أحداث للأزرار
    document.querySelectorAll('.revoke-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const key = this.getAttribute('data-key');
        revokeLicense(key);
      });
    });
    
    document.querySelectorAll('.restore-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const key = this.getAttribute('data-key');
        restoreLicense(key);
      });
    });
    
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const key = this.getAttribute('data-key');
        deleteLicense(key);
      });
    });
    
    document.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const key = this.getAttribute('data-key');
        copyToClipboard(key);
        showMessage(`تم نسخ المفتاح: ${key}`, 'success');
      });
    });
  }
  
  /**
   * تنسيق التاريخ بطريقة أفضل
   */
  function formatDate(date) {
    if (!(date instanceof Date) || isNaN(date)) {
      return 'تاريخ غير صالح';
    }
    
    return date.toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  
  /**
   * نسخ نص إلى الحافظة
   */
  function copyToClipboard(text) {
    // إنشاء عنصر نصي مؤقت
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'absolute';
    el.style.left = '-9999px';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  }
  
  /**
   * إنشاء ترخيص جديد
   */
  function createNewLicense() {
    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    const durationInput = document.getElementById('duration');
    const keyLengthInput = document.getElementById('key-length');
    const notesInput = document.getElementById('notes');
    
    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const duration = parseInt(durationInput.value);
    const keyLength = parseInt(keyLengthInput.value);
    const notes = notesInput.value.trim();
    
    if (!name || !email || !duration) {
      showMessage('يرجى ملء جميع الحقول المطلوبة', 'error');
      return;
    }
    
    showLoading(true);
    console.log('إنشاء ترخيص جديد');
    
    // الحصول على التراخيص الحالية أولاً
    const token = getGithubToken();
    
    if (token) {
      // استخدام GitHub Gist
      fetch(`https://api.github.com/gists/${GIST_ID}`, {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      })
      .then(response => response.json())
      .then(data => {
        let licenses = [];
        
        try {
          const licenseFile = data.files['licenses.json'];
          if (licenseFile) {
            licenses = JSON.parse(licenseFile.content);
          }
        } catch (error) {
          console.error('خطأ في تحليل التراخيص الحالية:', error);
          // استمر مع مصفوفة فارغة
        }
        
        // إنشاء مفتاح ترخيص جديد
        const newKey = generateLicenseKey(keyLength);
        const now = new Date();
        const expiryDate = new Date();
        expiryDate.setDate(now.getDate() + duration);
        
        // إنشاء كائن الترخيص الجديد
        const newLicense = {
          key: newKey,
          name: name,
          email: email,
          createdAt: now.toISOString(),
          expiry: expiryDate.toISOString(),
          revoked: false,
          notes: notes
        };
        
        console.log('ترخيص جديد:', newLicense);
        
        // إضافة الترخيص الجديد إلى القائمة
        licenses.push(newLicense);
        
        // حفظ التراخيص المحدثة إلى GitHub Gist
        return updateLicenses(licenses, newKey);
      })
      .then((newKey) => {
        if (newKey) {
          showMessage(`تم إنشاء ترخيص جديد بنجاح: ${newKey}`, 'success');
          // نسخ المفتاح إلى الحافظة تلقائياً
          copyToClipboard(newKey);
          licenseForm.reset();
          loadLicenses();
        }
      })
      .catch(error => {
        console.error('خطأ في إنشاء الترخيص:', error);
        showMessage('حدث خطأ أثناء إنشاء الترخيص. يرجى المحاولة مرة أخرى.', 'error');
      })
      .finally(() => {
        showLoading(false);
      });
    } else {
      // العمل بدون GitHub
      const newKey = generateLicenseKey(keyLength);
      showMessage(`تم إنشاء ترخيص جديد (محلي فقط): ${newKey}`, 'success');
      copyToClipboard(newKey);
      licenseForm.reset();
      showLoading(false);
    }
  }
  
  /**
   * إلغاء ترخيص
   */
  function revokeLicense(licenseKey) {
    if (!confirm('هل أنت متأكد من إلغاء هذا الترخيص؟')) {
      return;
    }
    
    showLoading(true);
    console.log('إلغاء الترخيص:', licenseKey);
    
    const token = getGithubToken();
    if (!token) {
      showMessage('لا يمكن إلغاء الترخيص بدون توكن GitHub', 'error');
      showLoading(false);
      return;
    }
    
    fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    })
    .then(response => response.json())
    .then(data => {
      try {
        const licenseFile = data.files['licenses.json'];
        if (!licenseFile) {
          throw new Error('ملف التراخيص غير موجود');
        }
        
        const licenses = JSON.parse(licenseFile.content);
        const updatedLicenses = licenses.map(license => {
          if (license.key === licenseKey) {
            return { ...license, revoked: true };
          }
          return license;
        });
        
        return updateLicenses(updatedLicenses);
      } catch (error) {
        throw new Error('فشل في تحديث الترخيص: ' + error.message);
      }
    })
    .then(() => {
      showMessage('تم إلغاء الترخيص بنجاح', 'success');
      loadLicenses();
    })
    .catch(error => {
      console.error('خطأ في إلغاء الترخيص:', error);
      showMessage('حدث خطأ أثناء إلغاء الترخيص: ' + error.message, 'error');
    })
    .finally(() => {
      showLoading(false);
    });
  }
  
  /**
   * استعادة ترخيص ملغي
   */
  function restoreLicense(licenseKey) {
    showLoading(true);
    console.log('استعادة الترخيص:', licenseKey);
    
    const token = getGithubToken();
    if (!token) {
      showMessage('لا يمكن استعادة الترخيص بدون توكن GitHub', 'error');
      showLoading(false);
      return;
    }
    
    fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    })
    .then(response => response.json())
    .then(data => {
      try {
        const licenseFile = data.files['licenses.json'];
        if (!licenseFile) {
          throw new Error('ملف التراخيص غير موجود');
        }
        
        const licenses = JSON.parse(licenseFile.content);
        const updatedLicenses = licenses.map(license => {
          if (license.key === licenseKey) {
            return { ...license, revoked: false };
          }
          return license;
        });
        
        return updateLicenses(updatedLicenses);
      } catch (error) {
        throw new Error('فشل في تحديث الترخيص: ' + error.message);
      }
    })
    .then(() => {
      showMessage('تم استعادة الترخيص بنجاح', 'success');
      loadLicenses();
    })
    .catch(error => {
      console.error('خطأ في استعادة الترخيص:', error);
      showMessage('حدث خطأ أثناء استعادة الترخيص: ' + error.message, 'error');
    })
    .finally(() => {
      showLoading(false);
    });
  }
  
  /**
   * حذف ترخيص
   */
  function deleteLicense(licenseKey) {
    if (!confirm('هل أنت متأكد من حذف هذا الترخيص نهائيًا؟ لا يمكن التراجع عن هذا الإجراء.')) {
      return;
    }
    
    showLoading(true);
    console.log('حذف الترخيص:', licenseKey);
    
    const token = getGithubToken();
    if (!token) {
      showMessage('لا يمكن حذف الترخيص بدون توكن GitHub', 'error');
      showLoading(false);
      return;
    }
    
    fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    })
    .then(response => response.json())
    .then(data => {
      try {
        const licenseFile = data.files['licenses.json'];
        if (!licenseFile) {
          throw new Error('ملف التراخيص غير موجود');
        }
        
        const licenses = JSON.parse(licenseFile.content);
        const updatedLicenses = licenses.filter(license => license.key !== licenseKey);
        
        return updateLicenses(updatedLicenses);
      } catch (error) {
        throw new Error('فشل في حذف الترخيص: ' + error.message);
      }
    })
    .then(() => {
      showMessage('تم حذف الترخيص بنجاح', 'success');
      loadLicenses();
    })
    .catch(error => {
      console.error('خطأ في حذف الترخيص:', error);
      showMessage('حدث خطأ أثناء حذف الترخيص: ' + error.message, 'error');
    })
    .finally(() => {
      showLoading(false);
    });
  }
  
  /**
   * تحديث قائمة التراخيص في GitHub Gist
   */
  function updateLicenses(licenses, newKey = null) {
    console.log('تحديث قائمة التراخيص');
    
    const token = getGithubToken();
    if (!token) {
      showMessage('لا يمكن تحديث التراخيص بدون توكن GitHub', 'error');
      return Promise.reject(new Error('لا يوجد توكن GitHub'));
    }
    
    return fetch(`https://api.github.com/gists/${GIST_ID}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        files: {
          'licenses.json': {
            content: JSON.stringify(licenses, null, 2)
          }
        }
      })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('فشل في تحديث بيانات التراخيص: ' + response.status);
      }
      return response.json();
    })
    .then(() => {
      console.log('تم تحديث التراخيص بنجاح');
      return newKey; // إرجاع المفتاح الجديد إذا كان موجودًا
    });
  }
  
  /**
   * توليد مفتاح ترخيص عشوائي
   */
  function generateLicenseKey(length = 24) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let key = '';
    
    // إنشاء مفتاح عشوائي بالطول المحدد
    for (let i = 0; i < length; i++) {
      if (i > 0 && i % 4 === 0) {
        key += '-';
      }
      const randomIndex = Math.floor(Math.random() * chars.length);
      key += chars[randomIndex];
    }
    
    return key;
  }
  
  /**
   * عرض رسالة للمستخدم
   */
  function showMessage(message, type) {
    console.log(`رسالة (${type}):`, message);
    
    messageContainer.textContent = message;
    messageContainer.className = '';
    messageContainer.classList.add(type);
    messageContainer.style.display = 'block';
    
    // إخفاء الرسالة بعد 5 ثوانٍ
    setTimeout(() => {
      messageContainer.style.display = 'none';
    }, 5000);
  }
  
  /**
   * إظهار أو إخفاء مؤشر التحميل
   */
  function showLoading(show) {
    loadingIndicator.style.display = show ? 'flex' : 'none';
  }
}); 
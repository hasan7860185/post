/**
 * نظام إدارة التراخيص - لوحة المسؤول
 */

// المتغيرات العامة
const GIST_ID = 'YOUR_GIST_ID'; // استبدل بمعرف Gist الخاص بك
const GITHUB_TOKEN = 'YOUR_GITHUB_TOKEN'; // استبدل بالتوكن الخاص بك (يجب إنشاؤه من إعدادات GitHub)

document.addEventListener('DOMContentLoaded', function() {
  // المراجع للعناصر
  const licenseForm = document.getElementById('license-form');
  const refreshBtn = document.getElementById('refresh-btn');
  const messageContainer = document.getElementById('message-container');
  const loadingIndicator = document.getElementById('loading');
  
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
   * تحميل قائمة التراخيص من GitHub Gist
   */
  function loadLicenses() {
    showLoading(true);
    
    fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('فشل في الاتصال بالخادم');
      }
      return response.json();
    })
    .then(data => {
      try {
        const licenseFile = data.files['licenses.json'];
        if (!licenseFile) {
          throw new Error('ملف التراخيص غير موجود');
        }
        
        const licenses = JSON.parse(licenseFile.content);
        renderLicensesList(licenses);
        showMessage('تم تحميل بيانات التراخيص بنجاح.', 'success');
      } catch (error) {
        console.error('Error parsing license data:', error);
        showMessage('حدث خطأ في تحميل بيانات التراخيص.', 'error');
      }
    })
    .catch(error => {
      console.error('Error loading licenses:', error);
      showMessage('فشل الاتصال بالخادم. يرجى المحاولة لاحقًا.', 'error');
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
      
      const createdDate = new Date(license.createdAt).toLocaleDateString('ar-SA');
      const expiryDateFormatted = expiryDate.toLocaleDateString('ar-SA');
      
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
    
    // الحصول على التراخيص الحالية أولاً
    fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
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
        console.error('Error parsing current licenses:', error);
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
      
      // إضافة الترخيص الجديد إلى القائمة
      licenses.push(newLicense);
      
      // حفظ التراخيص المحدثة إلى GitHub Gist
      return updateLicenses(licenses);
    })
    .then(() => {
      showMessage(`تم إنشاء ترخيص جديد بنجاح: ${generateLicenseKey(keyLength)}`, 'success');
      licenseForm.reset();
      loadLicenses();
    })
    .catch(error => {
      console.error('Error creating license:', error);
      showMessage('حدث خطأ أثناء إنشاء الترخيص. يرجى المحاولة مرة أخرى.', 'error');
    })
    .finally(() => {
      showLoading(false);
    });
  }
  
  /**
   * إلغاء ترخيص
   */
  function revokeLicense(licenseKey) {
    if (!confirm('هل أنت متأكد من إلغاء هذا الترخيص؟')) {
      return;
    }
    
    showLoading(true);
    
    fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
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
        throw new Error('فشل في تحديث الترخيص');
      }
    })
    .then(() => {
      showMessage('تم إلغاء الترخيص بنجاح', 'success');
      loadLicenses();
    })
    .catch(error => {
      console.error('Error revoking license:', error);
      showMessage('حدث خطأ أثناء إلغاء الترخيص', 'error');
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
    
    fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
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
        throw new Error('فشل في تحديث الترخيص');
      }
    })
    .then(() => {
      showMessage('تم استعادة الترخيص بنجاح', 'success');
      loadLicenses();
    })
    .catch(error => {
      console.error('Error restoring license:', error);
      showMessage('حدث خطأ أثناء استعادة الترخيص', 'error');
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
    
    fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
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
        throw new Error('فشل في حذف الترخيص');
      }
    })
    .then(() => {
      showMessage('تم حذف الترخيص بنجاح', 'success');
      loadLicenses();
    })
    .catch(error => {
      console.error('Error deleting license:', error);
      showMessage('حدث خطأ أثناء حذف الترخيص', 'error');
    })
    .finally(() => {
      showLoading(false);
    });
  }
  
  /**
   * تحديث قائمة التراخيص في GitHub Gist
   */
  function updateLicenses(licenses) {
    return fetch(`https://api.github.com/gists/${GIST_ID}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
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
        throw new Error('فشل في تحديث بيانات التراخيص');
      }
      return response.json();
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
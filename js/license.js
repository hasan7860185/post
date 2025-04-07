/**
 * نظام التحقق من التراخيص للإضافة
 */

// تكوين نظام الترخيص
const GIST_ID = '234b3837c2ca95e54c68c55a8bfd0e3c'; // استبدل هذا بمعرف Gist الخاص بك

/**
 * محاكاة واجهة chrome.storage للاختبار إذا لم تكن متوفرة
 */
function mockChromeStorage() {
  console.log('استخدام تخزين وهمي للاختبار');
  window.chrome = window.chrome || {};
  chrome.storage = {
    local: {
      get: function(key, callback) {
        console.log('محاكاة قراءة التخزين المحلي:', key);
        const data = {};
        if (typeof key === 'string') {
          data[key] = localStorage.getItem(key);
        } else if (Array.isArray(key)) {
          key.forEach(k => {
            data[k] = localStorage.getItem(k);
          });
        } else {
          Object.keys(key).forEach(k => {
            const value = localStorage.getItem(k);
            data[k] = value !== null ? value : key[k];
          });
        }
        callback(data);
      },
      set: function(data, callback) {
        console.log('محاكاة حفظ التخزين المحلي:', data);
        Object.keys(data).forEach(key => {
          localStorage.setItem(key, data[key]);
        });
        if (callback) callback();
      }
    }
  };
}

// التحقق من وجود واجهة chrome.storage وإلا استخدام محاكاة
if (typeof chrome === 'undefined' || !chrome.storage) {
  console.log('chrome.storage غير متوفر، استخدام محاكاة');
  mockChromeStorage();
}

// التحقق من وجود ترخيص مخزن عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
  console.log('تحميل صفحة الترخيص');
  
  // عناصر الصفحة
  const licenseForm = document.getElementById('license-form');
  const licenseKeyInput = document.getElementById('license-key');
  const validLicense = document.getElementById('valid-license');
  const expiredLicense = document.getElementById('expired-license');
  const errorLicense = document.getElementById('error-license');
  const loading = document.getElementById('loading');
  const licenseDetails = document.getElementById('license-details');
  const debugInfo = document.getElementById('debug-info');
  
  // التحقق من وجود ترخيص مخزن
  checkStoredLicense();
  
  // إضافة مستمع حدث للنموذج
  licenseForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const licenseKey = licenseKeyInput.value.trim();
    if (licenseKey) {
      verifyLicense(licenseKey);
    } else {
      showError('يرجى إدخال مفتاح الترخيص');
    }
  });
  
  /**
   * التحقق من وجود ترخيص مخزن سابقاً
   */
  function checkStoredLicense() {
    try {
      console.log('التحقق من وجود ترخيص مخزن');
      
      if (chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['license_key', 'license_status', 'license_expiry', 'license_data'], function(data) {
          console.log('تم استرداد بيانات الترخيص من التخزين:', data);
          
          if (data.license_key && data.license_status === 'valid') {
            console.log('تم العثور على ترخيص صالح:', data.license_key);
            
            // التحقق من صلاحية الترخيص المحفوظ
            const expiryDate = new Date(data.license_expiry);
            const now = new Date();
            
            if (expiryDate > now) {
              console.log('الترخيص ساري المفعول حتى:', expiryDate);
              // عرض تفاصيل الترخيص المحفوظ
              displayLicenseDetails(data.license_data);
              showSuccess('تم العثور على ترخيص صالح');
            } else {
              console.log('الترخيص منتهي الصلاحية:', expiryDate);
              showExpired('انتهت صلاحية الترخيص المحفوظ');
              licenseKeyInput.value = data.license_key;
            }
          } else {
            console.log('لم يتم العثور على ترخيص صالح مخزن');
            // لا يوجد ترخيص مخزن، تجهيز الاستمارة
            hideAllStatus();
          }
        });
      } else {
        console.warn('chrome.storage.local غير متوفر للتحقق من الترخيص المخزن');
        hideAllStatus();
      }
    } catch (error) {
      console.error('خطأ في التحقق من الترخيص المخزن:', error);
      hideAllStatus();
    }
  }
  
  /**
   * التحقق من صلاحية الترخيص
   */
  function verifyLicense(licenseKey) {
    // عرض حالة التحميل
    hideAllStatus();
    loading.style.display = 'flex';
    
    console.log('التحقق من الترخيص:', licenseKey);
    updateDebugInfo(`جارٍ التحقق من المفتاح: ${licenseKey}`);
    
    // محاولة الحصول على التراخيص من GitHub Gist
    fetch(`https://api.github.com/gists/${GIST_ID}`)
      .then(response => {
        console.log('استجابة GitHub:', response.status);
        updateDebugInfo(`استجابة GitHub: ${response.status}`);
        
        if (!response.ok) {
          throw new Error(`فشل في الاتصال بخادم التحقق (${response.status})`);
        }
        return response.json();
      })
      .then(data => {
        try {
          console.log('تم استلام البيانات من GitHub');
          
          // الحصول على ملف التراخيص
          const licenseFile = data.files['licenses.json'];
          if (!licenseFile) {
            throw new Error('ملف التراخيص غير موجود');
          }
          
          // تحليل بيانات التراخيص
          const licenses = JSON.parse(licenseFile.content);
          console.log('عدد التراخيص المتاحة:', Object.keys(licenses).length);
          updateDebugInfo(`عدد التراخيص: ${Object.keys(licenses).length}`);
          
          // البحث عن الترخيص المطلوب
          const license = licenses[licenseKey];
          
          if (!license) {
            console.log('الترخيص غير موجود:', licenseKey);
            updateDebugInfo('المفتاح غير موجود في قاعدة البيانات');
            showError('مفتاح الترخيص غير صالح');
            return;
          }
          
          // التحقق من أن الترخيص غير ملغى
          if (license.revoked) {
            console.log('الترخيص ملغى:', licenseKey);
            updateDebugInfo('المفتاح ملغى');
            showError('هذا الترخيص تم إلغاؤه');
            return;
          }
          
          // التحقق من صلاحية تاريخ الانتهاء
          const expiryDate = new Date(license.expiry);
          const now = new Date();
          
          if (expiryDate <= now) {
            console.log('الترخيص منتهي الصلاحية:', expiryDate);
            updateDebugInfo(`منتهي الصلاحية: ${expiryDate.toISOString()}`);
            showExpired('انتهت صلاحية هذا الترخيص');
            
            // حفظ معلومات الترخيص المنتهي
            saveLicenseInfo(licenseKey, 'expired', license);
            
            // عرض تفاصيل الترخيص المنتهي
            displayLicenseDetails(license);
            return;
          }
          
          // الترخيص صالح
          console.log('الترخيص صالح حتى:', expiryDate);
          updateDebugInfo(`ترخيص صالح حتى: ${expiryDate.toISOString()}`);
          showSuccess('تم التحقق من صلاحية الترخيص بنجاح');
          
          // حفظ معلومات الترخيص الصالح
          saveLicenseInfo(licenseKey, 'valid', license);
          
          // عرض تفاصيل الترخيص
          displayLicenseDetails(license);
          
        } catch (error) {
          console.error('خطأ في تحليل بيانات الترخيص:', error);
          updateDebugInfo(`خطأ في المعالجة: ${error.message}`);
          showError('حدث خطأ أثناء التحقق من الترخيص');
        }
      })
      .catch(error => {
        console.error('خطأ في التحقق من الترخيص:', error);
        updateDebugInfo(`خطأ في الاتصال: ${error.message}`);
        
        // محاولة استخدام الملف المحلي كخطة بديلة
        fetch('../licenses.json')
          .then(response => {
            if (!response.ok) {
              throw new Error('فشل في تحميل الملف المحلي');
            }
            return response.json();
          })
          .then(licenses => {
            const license = licenses[licenseKey];
            
            if (!license) {
              showError('مفتاح الترخيص غير صالح');
              return;
            }
            
            if (license.revoked) {
              showError('هذا الترخيص تم إلغاؤه');
              return;
            }
            
            const expiryDate = new Date(license.expiry);
            const now = new Date();
            
            if (expiryDate <= now) {
              showExpired('انتهت صلاحية هذا الترخيص');
              saveLicenseInfo(licenseKey, 'expired', license);
              displayLicenseDetails(license);
              return;
            }
            
            showSuccess('تم التحقق من صلاحية الترخيص بنجاح');
            saveLicenseInfo(licenseKey, 'valid', license);
            displayLicenseDetails(license);
          })
          .catch(error => {
            console.error('خطأ في تحميل الملف المحلي:', error);
            showError('تعذر التحقق من الترخيص. يرجى التحقق من اتصالك بالإنترنت.');
          });
      })
      .finally(() => {
        loading.style.display = 'none';
      });
  }
  
  /**
   * حفظ معلومات الترخيص في التخزين المحلي
   */
  function saveLicenseInfo(licenseKey, status, licenseData) {
    console.log('حفظ معلومات الترخيص:', status);
    
    if (chrome && chrome.storage && chrome.storage.local) {
      try {
        chrome.storage.local.set({
          'license_key': licenseKey,
          'license_status': status,
          'license_expiry': licenseData.expiry,
          'license_data': licenseData,
          'license_verified_at': new Date().toISOString()
        }, function() {
          console.log('تم حفظ معلومات الترخيص في التخزين المحلي');
        });
      } catch (error) {
        console.error('خطأ في حفظ معلومات الترخيص:', error);
      }
    } else {
      console.warn('chrome.storage.local غير متوفر لحفظ معلومات الترخيص');
    }
  }
  
  /**
   * عرض تفاصيل الترخيص في الواجهة
   */
  function displayLicenseDetails(license) {
    console.log('عرض تفاصيل الترخيص:', license);
    
    // عرض قسم التفاصيل
    licenseDetails.style.display = 'block';
    
    // ملء البيانات
    document.getElementById('license-user').textContent = license.name || '-';
    document.getElementById('license-email').textContent = license.email || '-';
    
    // تنسيق التواريخ
    if (license.createdAt) {
      const createdDate = new Date(license.createdAt);
      document.getElementById('license-created').textContent = formatDate(createdDate);
    }
    
    if (license.expiry) {
      const expiryDate = new Date(license.expiry);
      document.getElementById('license-expiry').textContent = formatDate(expiryDate);
      
      // حساب الأيام المتبقية
      const now = new Date();
      const diffTime = expiryDate - now;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      document.getElementById('license-remaining').textContent = 
        diffDays > 0 ? `${diffDays} يوم` : 'منتهي الصلاحية';
    }
    
    // نوع الترخيص
    document.getElementById('license-type').textContent = license.type || 'قياسي';
  }
  
  /**
   * تنسيق التاريخ بصيغة مقروءة
   */
  function formatDate(date) {
    if (!(date instanceof Date) || isNaN(date)) {
      return 'تاريخ غير صالح';
    }
    
    return date.toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
  
  /**
   * عرض رسالة خطأ
   */
  function showError(message) {
    console.log('خطأ:', message);
    hideAllStatus();
    errorLicense.style.display = 'block';
    updateDebugInfo(message);
  }
  
  /**
   * عرض رسالة نجاح
   */
  function showSuccess(message) {
    console.log('نجاح:', message);
    hideAllStatus();
    validLicense.style.display = 'block';
    updateDebugInfo(message);
  }
  
  /**
   * عرض رسالة انتهاء الصلاحية
   */
  function showExpired(message) {
    console.log('منتهي الصلاحية:', message);
    hideAllStatus();
    expiredLicense.style.display = 'block';
    updateDebugInfo(message);
  }
  
  /**
   * إخفاء جميع رسائل الحالة
   */
  function hideAllStatus() {
    validLicense.style.display = 'none';
    errorLicense.style.display = 'none';
    expiredLicense.style.display = 'none';
    licenseDetails.style.display = 'none';
  }
  
  /**
   * تحديث معلومات التصحيح
   */
  function updateDebugInfo(message) {
    if (debugInfo) {
      const now = new Date();
      const timestamp = now.toLocaleTimeString();
      const currentContent = debugInfo.textContent;
      debugInfo.textContent = `[${timestamp}] ${message}\n${currentContent}`;
    }
  }
}); 
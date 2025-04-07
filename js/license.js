/**
 * نظام إدارة التراخيص لـ FBGroupMaster
 */

document.addEventListener('DOMContentLoaded', function() {
  const licenseKeyInput = document.getElementById('license-key');
  const verifyButton = document.getElementById('verify-license');
  const statusElement = document.getElementById('license-status');
  
  // تحقق إذا كان هناك ترخيص مخزن مسبقًا
  checkStoredLicense();
  
  // إضافة حدث النقر على زر التحقق
  verifyButton.addEventListener('click', function() {
    const licenseKey = licenseKeyInput.value.trim();
    
    if (!licenseKey) {
      showError('يرجى إدخال مفتاح الترخيص');
      return;
    }
    
    // عرض حالة التحميل
    statusElement.textContent = 'جاري التحقق من الترخيص...';
    statusElement.className = 'license-status';
    statusElement.style.display = 'block';
    
    // التحقق من الترخيص على الخادم
    verifyLicense(licenseKey);
  });
  
  // أيضًا تنفيذ التحقق عند الضغط على مفتاح Enter
  licenseKeyInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      verifyButton.click();
    }
  });
});

/**
 * التحقق من وجود ترخيص مخزن
 */
function checkStoredLicense() {
  chrome.storage.local.get(['license'], function(result) {
    if (result.license && result.license.key && result.license.valid && new Date(result.license.expiry) > new Date()) {
      // الترخيص صالح، انتقل إلى الصفحة الرئيسية
      redirectToMainApp();
    }
  });
}

/**
 * التحقق من صحة الترخيص على السيرفر
 * @param {string} licenseKey - مفتاح الترخيص المراد التحقق منه
 */
function verifyLicense(licenseKey) {
  // قم بتشفير المفتاح قبل إرسال الطلب للتحقق من صحة بيانات الجهاز
  const deviceId = generateDeviceId();
  
  // في هذا المثال، نستخدم GitHub Gist كقاعدة بيانات بسيطة للتراخيص
  // يمكنك استبدال هذا بخدمة API خاصة بك
  fetch('https://api.github.com/gists/YOUR_GIST_ID')
    .then(response => {
      if (!response.ok) {
        throw new Error('فشل الاتصال بخادم التحقق');
      }
      return response.json();
    })
    .then(data => {
      // استخراج قائمة التراخيص من الـ Gist
      try {
        const licenseFile = data.files['licenses.json'];
        if (!licenseFile) {
          throw new Error('ملف التراخيص غير موجود');
        }
        
        const licenses = JSON.parse(licenseFile.content);
        const foundLicense = licenses.find(license => license.key === licenseKey);
        
        if (foundLicense) {
          // التحقق من صلاحية الترخيص
          if (foundLicense.revoked) {
            showError('هذا الترخيص تم إلغاؤه');
            return;
          }
          
          const expiryDate = new Date(foundLicense.expiry);
          if (expiryDate < new Date()) {
            showError('انتهت صلاحية هذا الترخيص');
            return;
          }
          
          // إذا وصلنا إلى هنا، فالترخيص صالح
          saveLicense(foundLicense);
          showSuccess('تم التحقق من الترخيص بنجاح');
          
          // الانتقال للصفحة الرئيسية بعد 1.5 ثانية
          setTimeout(redirectToMainApp, 1500);
        } else {
          showError('مفتاح الترخيص غير صالح');
        }
      } catch (error) {
        showError('حدث خطأ أثناء التحقق من الترخيص');
        console.error('Error parsing license data:', error);
      }
    })
    .catch(error => {
      showError('تعذر الاتصال بخادم التحقق، يرجى المحاولة لاحقًا');
      console.error('License verification error:', error);
    });
}

/**
 * حفظ بيانات الترخيص في التخزين المحلي
 * @param {Object} license - بيانات الترخيص
 */
function saveLicense(license) {
  const licenseData = {
    key: license.key,
    name: license.name,
    email: license.email,
    valid: true,
    expiry: license.expiry,
    activatedAt: new Date().toISOString(),
    deviceId: generateDeviceId()
  };
  
  chrome.storage.local.set({ license: licenseData }, function() {
    console.log('License saved successfully');
  });
}

/**
 * إنشاء معرّف فريد للجهاز
 * @returns {string} معرّف الجهاز
 */
function generateDeviceId() {
  // استخدام معلومات المتصفح لإنشاء معرّف
  const navigator_info = window.navigator;
  const screen_info = window.screen;
  let uid = navigator_info.userAgent.replace(/\D+/g, '');
  uid += screen_info.height || '';
  uid += screen_info.width || '';
  uid += screen_info.pixelDepth || '';
  
  return btoa(uid).substring(0, 32);
}

/**
 * عرض رسالة خطأ
 * @param {string} message - رسالة الخطأ
 */
function showError(message) {
  const statusElement = document.getElementById('license-status');
  statusElement.textContent = message;
  statusElement.className = 'license-status error';
  statusElement.style.display = 'block';
}

/**
 * عرض رسالة نجاح
 * @param {string} message - رسالة النجاح
 */
function showSuccess(message) {
  const statusElement = document.getElementById('license-status');
  statusElement.textContent = message;
  statusElement.className = 'license-status success';
  statusElement.style.display = 'block';
}

/**
 * الانتقال إلى الصفحة الرئيسية للتطبيق
 */
function redirectToMainApp() {
  window.location.href = 'popup.html';
} 
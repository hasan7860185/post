function setupEventListeners() {
  // إظهار خيارات التكرار عند تحديد خيار التكرار
  document.getElementById('enable-recurring').addEventListener('change', event => {
    const recurringOptions = document.getElementById('recurring-options');
    recurringOptions.style.display = event.target.checked ? 'block' : 'none';
  });

  // إظهار خيارات التكرار في مربع حوار التعديل
  document.getElementById('edit-enable-recurring').addEventListener('change', event => {
    const recurringOptions = document.getElementById('edit-recurring-options');
    recurringOptions.style.display = event.target.checked ? 'block' : 'none';
  });
} 
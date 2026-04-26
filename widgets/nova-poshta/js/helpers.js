// js/helpers.js
// 🧰 Допоміжні функції для роботи форми ShiftTime_CRM

/**
 * ☎️ Приводить номер телефону до стандартного формату:
 * - +380671234567 → 0671234567
 * - 380671234567 → 0671234567
 * - +441234567890 → +441234567890
 * - 0671234567 → 0671234567
 * @param {string} phone - Сировий номер
 * @returns {string} - Нормалізований номер
 */
// ☎️ Перетворення номера для запису в таблицю
export function preparePhoneForTable(phone) {
  const digitsOnly = phone.replace(/\D/g, ""); // лишаємо лише цифри

  if (phone.startsWith("+380") || phone.startsWith("380")) {
    return "0" + digitsOnly.slice(3); // +380971234567 або 380971234567 → 0971234567
  }

  if (/^0\d{9}$/.test(phone)) return phone.slice(0, 11); // вже правильний український

  if (phone.startsWith("+")) return phone.slice(0, 16); // іноземний — залишаємо "+" і максимум 16 символів

  return digitsOnly.slice(0, 11); // fallback — 11 цифр без +
}


/**
 * ✉️ Перевірка email на базову валідність
 * @param {string} email
 * @returns {boolean}
 */
export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * ☎️ Базова валідація номера телефону (структурна, без DOM)
 * @param {string} phone
 * @returns {boolean}
 */
// ✅ Перевірка правильності телефону (з виводом помилок)
export function validatePhone(phone, inputId = null, feedbackId = null) {
  const input = inputId ? document.getElementById(inputId) : null;
  const feedback = feedbackId ? document.getElementById(feedbackId) : null;

  if (!phone) return false;
  if (/[^0-9+]/.test(phone)) {
    if (input) input.style.color = "red";
    if (feedback) {
      feedback.textContent = "❌ Номер може містити тільки цифри та '+'";
      feedback.style.color = "red";
    }
    return false;
  }

  let clean = phone.replace(/\D/g, "");
  let isForeign = false;

  if (phone.startsWith("+38")) clean = phone.slice(3);
  else if (phone.startsWith("38")) {
    clean = phone.slice(2);
    if (input) input.value = "+38" + clean;
  } else if (phone.startsWith("+")) {
    const code = phone.slice(1, 3);
    if (code !== "38") isForeign = true;
  }

  if (!isForeign && clean.length < 10) {
    if (input) input.style.color = "red";
    if (feedback) {
      feedback.textContent = "❌ У вашому номері не вистачає цифр";
      feedback.style.color = "red";
    }
    return false;
  }

  if (!isForeign && clean.length === 11) {
    if (input) input.style.color = "red";
    if (feedback) {
      feedback.textContent = "❌ У вашому номері забагато цифр";
      feedback.style.color = "red";
    }
    return false;
  }

  if (!isForeign && clean.length > 11) {
    if (input) input.value = "+38" + clean.slice(0, 10);
    if (feedback) {
      input.style.color = "red";
      feedback.textContent = "❌ Зайві цифри видалено";
      feedback.style.color = "red";
    }
    return false;
  }

  if (isForeign && clean.length > 15) {
    if (input) input.value = "+" + clean.slice(0, 15);
    if (input) input.style.color = "red";
    if (feedback) {
      feedback.textContent = "❌ У номері забагато цифр";
      feedback.style.color = "red";
    }
    return false;
  }

  if (isForeign) {
    if (input) input.style.color = "blue";
    if (feedback) {
      feedback.textContent = "ℹ️ Іноземний номер";
      feedback.style.color = "blue";
    }
  } else {
    if (input) input.style.color = "green";
    if (feedback) feedback.textContent = "";
  }

  return true;
}


/**
 * 🧩 Показує або ховає блок з іншим одержувачем
 * Працює на основі checkbox з id="otherRecipientToggle"
 */
export function toggleOtherFields() {
  const block = document.getElementById("otherFields");
  const checkbox = document.getElementById("otherRecipientToggle");

  if (block && checkbox) {
    block.style.display = checkbox.checked ? "block" : "none";
  }
}

/**
 * ✉️ Показує або ховає поле для email
 * Працює на основі checkbox з id="emailToggle"
 */
export function toggleEmailField() {
  const block = document.getElementById("emailField");
  const checkbox = document.getElementById("emailToggle");

  if (block && checkbox) {
    block.style.display = checkbox.checked ? "block" : "none";
  }
}

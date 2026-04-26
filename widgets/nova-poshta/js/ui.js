// ui.js
// 🎨 Відповідає за керування інтерфейсом форми: повідомлення, кнопки, фокус

/**
 * Показує повідомлення про помилку
 * @param {string} msg - Текст повідомлення
 */
export function showError(msg) {
  const el = document.getElementById("response");
  el.textContent = msg;
  el.style.color = "red";
}

/**
 * Показує повідомлення про успіх
 * @param {string} msg - Текст повідомлення
 */
export function showSuccess(msg) {
  const el = document.getElementById("response");
  el.textContent = msg;
  el.style.color = "green";
}

/**
 * Скидає повідомлення
 */
export function clearMessage() {
  const el = document.getElementById("response");
  el.textContent = "";
}

/**
 * Блокує кнопку надсилання, щоб уникнути повторного кліку
 */
export function disableSubmit() {
  const btn = document.querySelector('button[type="submit"]');
  if (btn) btn.disabled = true;
}

/**
 * Розблокує кнопку надсилання
 */
export function enableSubmit() {
  const btn = document.querySelector('button[type="submit"]');
  if (btn) btn.disabled = false;
}

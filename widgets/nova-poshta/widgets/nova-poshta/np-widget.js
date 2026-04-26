export function initNovaPoshtaWidget(containerId, callback) {
  const container = document.getElementById(containerId);
  if (!container) return console.error("❌ Контейнер не знайдено:", containerId);

  console.log("🔧 Ініціалізуємо Nova Poshta Widget...");

  container.innerHTML = `
    <div class="space-y-4 relative">
      <div>
        <label class="block text-sm font-medium">📦 Введіть місто</label>
        <input type="text" id="np-city-input" class="w-full px-2 py-1 border rounded" placeholder="Почніть вводити назву міста...">
        <ul id="np-city-suggestions" class="absolute z-10 bg-white border w-full mt-1 rounded shadow max-h-40 overflow-y-auto hidden"></ul>
      </div>
      <div>
        <label class="block text-sm font-medium">🌐 Область</label>
        <input type="text" id="np-region-display" class="w-full px-2 py-1 border rounded bg-gray-100" readonly>
      </div>
      <div>
        <label class="block text-sm font-medium">🏞️ Район (необов'язково)</label>
        <input type="text" id="region" name="region" placeholder="Наприклад: Подільський" class="w-full px-2 py-1 border rounded" />
      </div>
      <div>
        <label class="block text-sm font-medium">📦 Відділення</label>
        <select id="np-warehouse-select" class="w-full px-2 py-1 border rounded" disabled>
          <option>Спочатку оберіть місто</option>
        </select>
      </div>
    </div>
  `;

  // === helpers ===
  function setHiddenAndNotify(id, val) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = val ?? "";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
  function readDraft() {
    try { return JSON.parse(localStorage.getItem("customerDraft_v2") || "null"); }
    catch { return null; }
  }

  const input = document.getElementById("np-city-input");
  const regionDisplay = document.getElementById("np-region-display");
  const warehouseSelect = document.getElementById("np-warehouse-select");
  const suggestionsBox = document.getElementById("np-city-suggestions");
  const districtInput = document.getElementById("region");

  let cities = [];
  let cityData = null;
  let warehouses = [];

  // --- search city ---
  input.addEventListener("input", async () => {
    const query = input.value.trim();
    if (query.length < 3) {
      suggestionsBox.classList.add("hidden");
      return;
    }
    try {
      const res = await fetch("https://api.novaposhta.ua/v2.0/json/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: "a0102a00f2f88e7c84d935843d290edd",
          modelName: "Address",
          calledMethod: "getCities",
          methodProperties: { FindByString: query },
        }),
      });
      const json = await res.json();
      cities = json.data || [];
      suggestionsBox.innerHTML = cities.map(c =>
        `<li class="px-2 py-1 hover:bg-blue-100 cursor-pointer">${c.Description}</li>`
      ).join("");
      suggestionsBox.classList.remove("hidden");
    } catch (err) {
      console.error("❌ Помилка при пошуку міста:", err);
    }
  });

  // --- city pick ---
  suggestionsBox.addEventListener("click", (e) => {
    if (e.target.tagName !== "LI") return;
    const selectedText = e.target.textContent;
    input.value = selectedText;
    suggestionsBox.classList.add("hidden");

    cityData = cities.find(c => c.Description === selectedText);
    if (!cityData) return;

    regionDisplay.value = cityData.AreaDescription;

    // sync hidden + reset warehouse info
    setHiddenAndNotify("hidden-city", cityData.Description);
    setHiddenAndNotify("hidden-region", cityData.AreaDescription);
    setHiddenAndNotify("hidden-district", districtInput?.value || "");
    setHiddenAndNotify("hidden-warehouse", "");
    setHiddenAndNotify("hidden-street", "");
    setHiddenAndNotify("hidden-warehouse-number", "");
    setHiddenAndNotify("hidden-warehouse-type", "");

    loadWarehouses(cityData.Ref);
  });

  // --- warehouses loader ---
  async function loadWarehouses(cityRef, preferText = null) {
    try {
      const res = await fetch("https://api.novaposhta.ua/v2.0/json/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: "a0102a00f2f88e7c84d935843d290edd",
          modelName: "AddressGeneral",
          calledMethod: "getWarehouses",
          methodProperties: { CityRef: cityRef },
        }),
      });
      const json = await res.json();
      warehouses = json.data || [];

      warehouseSelect.innerHTML = warehouses.map(w => `<option>${w.Description}</option>`).join("");
      warehouseSelect.disabled = warehouses.length === 0;

      let targetText = preferText;
      if (!targetText && warehouses.length > 0) targetText = warehouses[0].Description;

      if (targetText) {
        warehouseSelect.value = targetText;
        updateSelectedWarehouse(targetText);
      }

      warehouseSelect.onchange = () => updateSelectedWarehouse(warehouseSelect.value);
      districtInput.oninput = () => updateSelectedWarehouse(warehouseSelect.value);
    } catch (err) {
      console.error("❌ Помилка при завантаженні відділень:", err);
    }
  }

  // --- warehouse change + sync hidden ---
  function updateSelectedWarehouse(selectedText) {
    const warehouse = warehouses.find(w => w.Description === selectedText);
    if (!warehouse) {
      console.warn("❌ Не знайдено відділення:", selectedText);
      return;
    }
    const lowerText = selectedText.toLowerCase();

    // number
    let number = warehouse.Number || "1";
    const m = selectedText.match(/№\s?(\d+)/);
    if (m) number = m[1];
    const warehouseNumber = `№${number}`;

    // type
    let type = "невідомий тип";
    if (lowerText.includes("поштомат")) type = "ПОШТОМАТ";
    else if (lowerText.includes("до 10 кг")) type = "до 10 кг";
    else if (lowerText.includes("до 30 кг")) type = "до 30 кг";

    // formatted number
    let formattedWarehouseNumber = warehouseNumber;
    if (lowerText.includes("мобільне")) formattedWarehouseNumber = `Мобільне відділення ${warehouseNumber}`;
    else if (lowerText.includes("склад")) formattedWarehouseNumber = `СКЛАД ${warehouseNumber}`;
    else if (lowerText.includes("пункт")) formattedWarehouseNumber = `ПУНКТ ${warehouseNumber}`;

    // street
    const street = selectedText.split(":")[1]?.trim() || warehouse.ShortAddress || "";

    const result = {
      city: cityData?.Description || "",
      region: cityData?.AreaDescription || "",
      district: districtInput?.value || "",
      warehouse: selectedText,
      street,
      warehouseNumber: formattedWarehouseNumber,
      warehouseType: type
    };

    // sync hidden (+ тригеримо 'input' → submit-all.js збереже драфт)
    setHiddenAndNotify("hidden-city", result.city);
    setHiddenAndNotify("hidden-region", result.region);
    setHiddenAndNotify("hidden-district", result.district);
    setHiddenAndNotify("hidden-warehouse", result.warehouse);
    setHiddenAndNotify("hidden-street", result.street);
    setHiddenAndNotify("hidden-warehouse-number", result.warehouseNumber);
    setHiddenAndNotify("hidden-warehouse-type", result.warehouseType);

    if (typeof callback === "function") callback(result);
  }

  // === 🔄 АВТОВІДНОВЛЕННЯ З ДРАФТУ ===
  (async function restoreFromDraftIntoWidget() {
    const d = readDraft();
    if (!d || !d.city) return;                 // нема що відновлювати

    // 1) заповнюємо видимі поля міста/області/району
    input.value = d.city;
    regionDisplay.value = d.region || "";
    districtInput.value = d.district || "";

    // 2) знаходимо реф міста і підтягуємо склади
    try {
      const res = await fetch("https://api.novaposhta.ua/v2.0/json/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: "a0102a00f2f88e7c84d935843d290edd",
          modelName: "Address",
          calledMethod: "getCities",
          methodProperties: { FindByString: d.city },
        }),
      });
      const js = await res.json();
      const list = js.data || [];
      // беремо точний збіг по назві, або перший
      cityData = list.find(c => c.Description === d.city) || list[0];
      if (!cityData) return;

      // одразу синхронізуємо hidden значення міста/області
      setHiddenAndNotify("hidden-city", cityData.Description);
      setHiddenAndNotify("hidden-region", cityData.AreaDescription);
      setHiddenAndNotify("hidden-district", districtInput.value);

      // 3) підтягуємо склади і ставимо той, що в драфті
      await loadWarehouses(cityData.Ref, d.warehouse || null);
    } catch (e) {
      console.warn("⚠️ Не вдалося відновити адресу з драфту:", e);
    }
  })();
}

// frontend/js/utils/price-cols.js
export const PriceSchema = {
  idx: {},                         // сюди покладемо colIdx із GAS
  set(idx) { this.idx = Object.fromEntries(
    Object.entries(idx || {}).map(([k,v]) => [String(k).toLowerCase(), v])
  ); },
  get(row, header) {
    const i = this.idx[String(header).toLowerCase()];
    return i == null ? undefined : row[i];
  }
};

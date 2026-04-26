// widgets/template/engine.js
// НІЧОГО НЕ ЛАМАЄ: лише додає window.TemplateEngine з методом render()

(function () {
  if (window.TemplateEngine) return; // захист від подвійного підключення

  const Helpers = {
    upper: v => String(v ?? '').toUpperCase(),
    lower: v => String(v ?? '').toLowerCase(),
    money: v => {
      const n = Number(String(v).replace(/[^\d.,-]/g,'').replace(',','.'));
      return isNaN(n) ? (v ?? '') : '₴' + n.toLocaleString('uk-UA');
    },
    date: v => {
      if (!v) return '';
      const d = new Date(v);
      return isNaN(d) ? String(v) :
        d.toLocaleString('uk-UA',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
    },
    phone: v => String(v ?? '').replace(/[^\d+]/g,''),
  };

  function render(tpl, data, extra = {}) {
    const H = Object.assign({}, Helpers, extra);
    const toStr = v => (v == null ? '' : String(v));
    const stripQuotes = s => s?.replace?.(/^(['"])(.*)\1$/, '$2') ?? s;
    const resolve = (obj, path) => {
      if (!path) return '';
      const parts = String(path).split('.');
      let cur = (parts[0] === 'this') ? (obj.this ?? obj) : obj;
      for (const p of (parts[0] === 'this' ? parts.slice(1) : parts)) {
        if (cur == null) return '';
        cur = cur[p];
      }
      return cur;
    };

    const run = (src, ctx) => {
      let out = String(src ?? '');

      // each
      out = out.replace(/{{#each\s+([\w.]+)\s*}}([\s\S]*?){{\/each}}/g,
        (_, path, inner) => {
          const arr = resolve(ctx, path);
          if (!Array.isArray(arr) || arr.length === 0) return '';
          return arr.map((it, i) => run(inner, Object.assign({}, ctx, { this: it, index: i }))).join('');
        });

      // if_eq
      out = out.replace(/{{#if_eq\s+([\w.]+)\s+([^}]+)\s*}}([\s\S]*?){{\/if_eq}}/g,
        (_, path, valRaw, inner) => {
          const cur = toStr(resolve(ctx, path));
          const val = stripQuotes(valRaw.trim());
          const [thenP, elseP=''] = inner.split(/{{\s*else\s*}}/);
          return run(cur === val ? thenP : elseP, ctx);
        });

      // if_in  → "A|B|C"
      out = out.replace(/{{#if_in\s+([\w.]+)\s+([^}]+)\s*}}([\s\S]*?){{\/if_in}}/g,
        (_, path, listRaw, inner) => {
          const cur = toStr(resolve(ctx, path));
          const list = stripQuotes(listRaw.trim()).split('|').map(s => s.trim());
          return run(list.includes(cur) ? inner : '', ctx);
        });

      // if_has  → підрядок (contains)
      out = out.replace(/{{#if_has\s+([\w.]+)\s+([^}]+)\s*}}([\s\S]*?){{\/if_has}}/g,
        (_, path, subRaw, inner) => {
          const cur = toStr(resolve(ctx, path)).toLowerCase();
          const sub = stripQuotes(subRaw.trim()).toLowerCase();
          return run(cur.includes(sub) ? inner : '', ctx);
        });

      // if (truthy)
      out = out.replace(/{{#if\s+([\w.]+)\s*}}([\s\S]*?){{\/if}}/g,
        (_, path, inner) => {
          const val = resolve(ctx, path);
          const [thenP, elseP=''] = inner.split(/{{\s*else\s*}}/);
          const truthy = !(val == null || String(val).trim() === '');
          return run(truthy ? thenP : elseP, ctx);
        });

      // inline helpers: {{helper key}}
      out = out.replace(/{{\s*(\w+)\s+([\w.]+)\s*}}/g, (m, h, p) => {
        if (H[h]) return String(H[h](resolve(ctx, p), ctx) ?? '');
        return m;
      });

      // variables: {{key}}
      out = out.replace(/{{\s*([\w.]+)\s*}}/g, (m, p) => toStr(resolve(ctx, p)));

      return out;
    };

    return run(tpl, data);
  }

  function registerHelper(name, fn) {
    if (typeof name === 'string' && typeof fn === 'function') {
      Helpers[name] = fn;
    }
  }

  window.TemplateEngine = { render, registerHelper };
})();

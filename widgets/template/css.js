// frontend/widgets/template/css.js
window.mountTemplateCss = function () {
  if (document.getElementById('tpl-css')) return;

  const s = document.createElement('style');
  s.id = 'tpl-css';
  s.textContent = `
    /* базове: щоб поля не вилазили */
    #tpl-center textarea,
    #tpl-center #tpl-preview { max-width: 100%; }

    /* === Фікс розтягування колонок у 3-спліті === */
    #tpl-left, #tpl-center, #tpl-right {
      box-sizing: border-box;
      min-width: 220px;
      flex: 0 0 auto; /* не даємо флексу самовільно змінювати ширину */
    }

    /* Контейнер спліта */
    #tpl-3split {
      display: flex;
      align-items: stretch;
      gap: 12px;
      position: relative;
      overflow: hidden; /* нічого не “вивалюється” за межі */
    }

    /* Ресайзери у флекс-лайауті */
    .tpl-resizer {
      flex: 0 0 10px;
      width: 10px;
    }

    /* Центр: шапка і дві половини по центру */
    #tpl-center .tplc-topbar{
      display: grid;
      grid-template-columns: 1fr minmax(360px, 720px) 1fr;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }
    #tpl-center .tplc-outer{ display:flex; justify-content:center; width:100%; }
    #tpl-center .tplc-grid{
      display: grid;
      grid-template-columns: 1fr 1fr; /* 50% | 50% */
      gap: 24px;
      width: min(1200px, 100%);      /* “рамка” двоколонки */
      margin: 0 auto;                /* центруємо сам грід */
      justify-items: center;
      align-items: start;
    }
    #tpl-center .tplc-col{ display:flex; justify-content:center; width:100%; }
    #tpl-center .tplc-inner{ width:85%; max-width:540px; margin:0 auto; }
    #tpl-center .tplc-inner label{ display:block; text-align:center; margin-bottom:6px; }
    #tpl-center #tpl-editor, #tpl-center #tpl-preview{
      width: 100%;
      min-height: 42vh;
      resize: vertical;
      box-sizing: border-box;
    }


    /* full-screen для JSON-модалки */
#tpl-json-dialog.is-fullscreen{
  width: 96vw !important;
  height: 92vh !important;
  max-height: 92vh !important;
}
#tpl-json-dialog.is-fullscreen #tpl-test-json{
  height: calc(92vh - 90px) !important; /* підгонка під шапку/кнопки */
  min-height: 0 !important;
}

  `;
  document.head.appendChild(s);
};

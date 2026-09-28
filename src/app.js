(() => {
  'use strict';
  const $ = id => document.getElementById(id), source = $('source'), preview = $('preview');
  const docs = new Map(), images = new Map(), exportNames = new Map();
  let current = '', timer, warnings = [], importVersion = 0;
  const esc = LuoguPDF.escape;
  function status(text) { $('status').textContent = text; }
  function documentName() { return (current.split('/').pop() || 'Markdown文档').replace(/\.(md|markdown|txt)$/i, ''); }
  function exportName() {
    let name = ($('export-name').value.trim() || documentName()).replace(/(?:\.(?:html?|pdf))+$/i, '');
    name = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/g, '').trim();
    if (!name) name = 'Markdown文档';
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) name = '_' + name;
    return name;
  }
  function updateExportName() {
    exportNames.set(current, $('export-name').value);
    document.title = exportName();
  }
  function normalize(path) {
    const parts = [];
    for (const part of path.replace(/\\/g, '/').split('/')) {
      if (part === '..') parts.pop(); else if (part && part !== '.') parts.push(part);
    }
    return parts.join('/');
  }
  function resolveImage(path) {
    try { path = decodeURIComponent(path.split(/[?#]/)[0]); } catch (_) {}
    const relative = normalize(current.slice(0, current.lastIndexOf('/') + 1) + path);
    if (images.has(relative)) return images.get(relative);
    if (images.has(normalize(path))) return images.get(normalize(path));
    const matches = [...images].filter(([key]) => key.split('/').pop() === normalize(path).split('/').pop());
    return matches.length === 1 ? matches[0][1] : undefined;
  }
  function settings() {
    const paper = ['A4', 'A5', 'Letter'].includes($('paper').value) ? $('paper').value : 'A4';
    const landscape = $('orientation').value === 'landscape';
    const size = Math.max(8, Math.min(20, Number($('font-size').value) || 10.5));
    const margin = Math.max(5, Math.min(35, Number($('margin').value) || 15));
    const dimensions = {A4:[210,297],A5:[148,210],Letter:[215.9,279.4]}[paper];
    return {size, margin, width:dimensions[+landscape], page:paper + (landscape ? ' landscape' : ' portrait')};
  }
  const printStyle = document.createElement('style'); document.head.append(printStyle);
  function renderNow() {
    clearTimeout(timer);
    if (current) docs.set(current, source.value);
    const result = LuoguPDF.render(source.value, {resolveImage, unlink:$('unlink').checked});
    warnings = result.warnings;
    preview.innerHTML = result.html;
    preview.classList.toggle('mono', $('mono').checked);
    const s = settings();
    preview.style.setProperty('--font-size', s.size + 'pt');
    preview.style.setProperty('--page-width', s.width + 'mm');
    preview.style.setProperty('--page-margin', s.margin + 'mm');
    printStyle.textContent = '@page{size:' + s.page + ';margin:' + s.margin + 'mm}';
    $('count').textContent = source.value.length.toLocaleString() + ' 字符';
    status(warnings.length ? warnings.length + ' 项提示：' + [...new Set(warnings)].slice(0, 4).join('；') : '预览已更新。导出 PDF 时，所有折叠内容都会展开。');
    preview.querySelectorAll('img').forEach(img => img.addEventListener('error', () => {
      status('图片加载失败：' + img.getAttribute('src') + '。请检查网络，或导入图片文件。');
    }, {once:true}));
    return result;
  }
  function selectDoc(path) {
    current = path; source.value = docs.get(path) || ''; $('documents').value = path;
    $('export-name').value = exportNames.get(path) || '';
    $('export-name').placeholder = documentName();
    updateExportName(); renderNow();
  }
  function listDocs() {
    $('documents').replaceChildren(...[...docs.keys()].map(path => { const o = document.createElement('option'); o.value = path; o.textContent = path; return o; }));
  }
  const readData = file => new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file);
  });
  async function importFiles(files, append = false) {
    const version = ++importVersion;
    status('正在读取本地文件……');
    try {
      const loaded = await Promise.all([...files].filter(f => /\.(md|markdown|txt|png|jpe?g|gif|webp|svg|avif|bmp)$/i.test(f.name)).map(async file => {
        const key = normalize(file.webkitRelativePath || file.name);
        const isDoc = /\.(md|markdown|txt)$/i.test(file.name);
        let value;
        if (isDoc) {
          const data = new Uint8Array(await file.arrayBuffer());
          value = new TextDecoder(data[0] === 255 && data[1] === 254 ? 'utf-16le' : data[0] === 254 && data[1] === 255 ? 'utf-16be' : 'utf-8').decode(data);
        } else value = await readData(file);
        return {key, value, isDoc};
      }));
      if (version !== importVersion) return;
      if (!append && loaded.some(f => f.isDoc)) { docs.clear(); images.clear(); exportNames.clear(); }
      for (const f of loaded) (f.isDoc ? docs : images).set(f.key, f.value);
      if (loaded.some(f => f.isDoc)) { listDocs(); selectDoc(loaded.find(f => f.isDoc).key); } else renderNow();
    } catch (error) { status('读取失败：' + error.message); }
  }
  function expandedArticle() {
    const clone = preview.cloneNode(true); clone.removeAttribute('id'); clone.removeAttribute('style');
    for (const details of [...clone.querySelectorAll('details')].reverse()) {
      const section = document.createElement('section'); section.className = details.className;
      const summary = details.querySelector(':scope > summary');
      if (summary) { const title = document.createElement('div'); title.className = 'callout-title'; title.append(...summary.childNodes); summary.replaceWith(title); }
      section.append(...details.childNodes); details.replaceWith(section);
    }
    return clone;
  }
  function makeDocument(article = expandedArticle()) {
    const s = settings(), title = exportName();
    return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>' + esc(title) + '</title><style>' + $('document-style').textContent + '\n@page{size:' + s.page + ';margin:' + s.margin + 'mm}body{--font-size:' + s.size + 'pt;margin:0 auto;padding:0;max-width:' + (s.width - 2*s.margin) + 'mm}@media screen{body{padding:20px}}' + '</style></head><body>' + article.outerHTML + '<template>' + ($('third-party-licenses')?.innerHTML || '') + '</template></body></html>';
  }
  async function ready(doc) {
    await Promise.race([doc.fonts.ready, new Promise(resolve => setTimeout(resolve, 10000))]);
    await Promise.all([...doc.images].map(img => img.complete ? Promise.resolve() : new Promise(resolve => {
      img.addEventListener('load', resolve, {once:true}); img.addEventListener('error', resolve, {once:true}); setTimeout(resolve, 10000);
    })));
    let missing = 0;
    for (const img of [...doc.images]) if (!img.complete || !img.naturalWidth) {
      missing++; const note = doc.createElement('span'); note.className = 'missing-image'; note.textContent = '图片加载失败：' + (img.alt || img.getAttribute('src')); img.replaceWith(note);
    }
    for (const element of doc.querySelectorAll('.math-block, table')) {
      const available = element.parentElement.clientWidth;
      const width = element.scrollWidth;
      if (width > available && available > 0) element.style.zoom = Math.max(.1, available / width);
    }
    return missing;
  }
  async function print() {
    updateExportName();
    renderNow(); $('print').disabled = true; status('正在准备字体、图片与打印页面……');
    try {
      $('print-frame')?.remove();
      const frame = document.createElement('iframe'); frame.id = 'print-frame'; frame.title = '打印文档';
      const loaded = new Promise(resolve => frame.onload = resolve);
      frame.srcdoc = makeDocument(); document.body.append(frame); await loaded;
      const missing = await ready(frame.contentDocument);
      status((missing ? missing + ' 张图片加载失败，已在文档中标注。' : '') + '请在打印窗口中选择“另存为 PDF”，关闭页眉和页脚。');
      frame.contentWindow.focus(); frame.contentWindow.print();
    } catch (error) { status('打印准备失败：' + error.message); }
    finally { $('print').disabled = false; }
  }
  function download(text, type, extension) {
    const link = document.createElement('a'), url = URL.createObjectURL(new Blob([text], {type}));
    link.href = url; link.download = (extension === '.md' ? documentName() : exportName()) + extension;
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  $('open-file').onclick = () => $('file-input').click();
  $('export-name').oninput = updateExportName;
  $('open-folder').onclick = () => $('folder-input').click();
  $('add-images').onclick = () => $('image-input').click();
  for (const id of ['file-input','folder-input','image-input']) $(id).onchange = event => { importFiles(event.target.files, id === 'image-input'); event.target.value = ''; };
  $('documents').onchange = event => { if (current) docs.set(current, source.value); selectDoc(event.target.value); };
  source.oninput = () => { clearTimeout(timer); timer = setTimeout(renderNow, 250); };
  for (const id of ['paper','orientation','font-size','margin','mono','unlink']) $(id).onchange = renderNow;
  function example() { docs.set('洛谷语法示例.md', window.EXAMPLE); listDocs(); selectDoc('洛谷语法示例.md'); }
  $('example').onclick = example; $('empty-example').onclick = example;
  $('print').onclick = print;
  $('save-md').onclick = () => download(source.value, 'text/markdown;charset=utf-8', '.md');
  $('export-html').onclick = () => {
    renderNow(); const article = expandedArticle();
    download(makeDocument(article), 'text/html;charset=utf-8', '.html');
    const remote = article.querySelectorAll('img[src^="http"]').length;
    status('已导出静态 HTML，公式字体与本地图片已内嵌。' + (remote ? remote + ' 张网络图片仍需联网加载。' : '可离线打开。'));
  };
  document.addEventListener('dragover', event => { if (event.dataTransfer.types.includes('Files')) event.preventDefault(); });
  document.addEventListener('drop', event => { if (event.dataTransfer.files.length) { event.preventDefault(); importFiles(event.dataTransfer.files); } });
  document.addEventListener('keydown', event => {
    if (!(event.ctrlKey || event.metaKey)) return;
    if (event.key.toLowerCase() === 'p') { event.preventDefault(); print(); }
    if (event.key.toLowerCase() === 's') { event.preventDefault(); $('save-md').click(); }
    if (event.key.toLowerCase() === 'o') { event.preventDefault(); $('open-file').click(); }
  });
  let closed = [];
  window.addEventListener('beforeprint', () => { closed = [...preview.querySelectorAll('details:not([open])')]; closed.forEach(d => d.open = true); });
  window.addEventListener('afterprint', () => closed.forEach(d => d.open = false));
  window.App = {renderNow, importFiles, makeDocument, ready, resolveImage};
})();

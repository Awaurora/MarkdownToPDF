/* Luogu syntax extensions for markdown-it. Raw HTML remains disabled. */
(() => {
  'use strict';
  const md = markdownit({html: false, linkify: true, typographer: false});
  const esc = md.utils.escapeHtml;
  const defaults = {'\\N': '\\mathbb{N}', '\\Z': '\\mathbb{Z}', '\\Q': '\\mathbb{Q}', '\\R': '\\mathbb{R}', '\\C': '\\mathbb{C}', '\\larr': '\\leftarrow', '\\rarr': '\\rightarrow'};

  function math(tex, display, env) {
    tex = tex.replace(/\\(textcolor|color)\{([\da-fA-F]{6})\}/g, '\\$1{#$2}');
    try {
      const node = MathJax.tex2svg('{' + tex + '}', {display});
      const error = node.querySelector('[data-mjx-error]');
      if (error) throw new Error(error.getAttribute('data-mjx-error'));
      return node.outerHTML;
    } catch (error) {
      env.warnings.push('公式无法解析：' + tex.slice(0, 100));
      return '<code class="math-error" title="' + esc(error.message) + '">' + esc((display ? '$$' : '$') + tex + (display ? '$$' : '$')) + '</code>';
    }
  }

  function escaped(text, pos) {
    let n = 0;
    while (pos > 0 && text[--pos] === '\\') n++;
    return n % 2 === 1;
  }

  md.inline.ruler.before('escape', 'luogu_math', (state, silent) => {
    const start = state.pos;
    if (state.src[start] !== '$') return false;
    let size = 1;
    while (state.src[start + size] === '$') size++;
    let end = start + size;
    for (;;) {
      end = state.src.indexOf('$', end);
      if (end < 0) return false;
      let count = 1;
      while (state.src[end + count] === '$') count++;
      if (!escaped(state.src, end) && count === size) break;
      end += count;
    }
    if (end === start + size) return false;
    if (!silent) {
      const token = state.push('luogu_math', 'math', 0);
      token.content = state.src.slice(start + size, end);
    }
    state.pos = end + size;
    return true;
  });
  md.renderer.rules.luogu_math = (tokens, idx, options, env) => math(tokens[idx].content, false, env);

  md.block.ruler.before('fence', 'luogu_math_block', (state, start, end, silent) => {
    if (state.sCount[start] - state.blkIndent >= 4) return false;
    const line = state.src.slice(state.bMarks[start] + state.tShift[start], state.eMarks[start]);
    const match = line.match(/^(\${2,})(.*)$/);
    if (!match) return false;
    const mark = match[1];
    let tail = match[2];
    if (tail.includes(mark) && !tail.trimEnd().endsWith(mark)) return false;
    if (silent) return true;
    let next = start + 1, content;
    if (tail.trimEnd().endsWith(mark)) {
      content = tail.trimEnd().slice(0, -mark.length);
    } else {
      const parts = [];
      // Like remark-math, text on an opening fence line is metadata.
      for (; next < end; next++) {
        if (state.sCount[next] < state.blkIndent && state.src.slice(state.bMarks[next], state.eMarks[next]).trim()) break;
        const value = state.src.slice(state.bMarks[next] + state.tShift[next], state.eMarks[next]);
        if (new RegExp('^\\${' + mark.length + ',}\\s*$').test(value)) { next++; break; }
        parts.push(state.src.slice(state.bMarks[next] + Math.min(state.tShift[next], state.blkIndent), state.eMarks[next]));
      }
      content = parts.join('\n');
    }
    const token = state.push('luogu_math_block', 'math', 0);
    token.block = true;
    token.content = content;
    token.map = [start, next];
    state.line = next;
    return true;
  }, {alt: ['paragraph', 'reference', 'blockquote', 'list']});
  md.renderer.rules.luogu_math_block = (tokens, idx, options, env) => '<div class="math-block">' + math(tokens[idx].content, true, env) + '</div>\n';

  function containerSpec(info) {
    const match = info.trim().match(/^(info|success|warning|error|align|epigraph)(?:\[(.*)\])?(?:\{([^}]*)\})?\s*$/);
    if (!match) return null;
    if (match[1] === 'align' && !/^(left|center|right)$/.test(match[3] || 'left')) return null;
    return {kind: match[1], title: match[2] || '', attrs: match[3] || ''};
  }
  function renderTitle(text, env) {
    const tokens = [];
    md.inline.parse(text, md, {...env, footnotes: undefined}, tokens);
    return md.renderer.renderInline(tokens, md.options, env);
  }
  md.use(markdownitContainer, 'luogu', {
    validate: info => Boolean(containerSpec(info)),
    render(tokens, idx, options, env) {
      const token = tokens[idx], spec = token.meta;
      if (token.nesting === -1) {
        if (spec.kind === 'align') return '</div>\n';
        if (spec.kind === 'epigraph') return (spec.title ? '<footer>' + renderTitle(spec.title, env) + '</footer>' : '') + '</blockquote>\n';
        return '</div></details>\n';
      }
      if (spec.kind === 'align') return '<div class="align-' + (spec.attrs || 'left') + '">\n';
      if (spec.kind === 'epigraph') return '<blockquote class="epigraph">\n';
      const titles = {info: '提示', success: '成功', warning: '警告', error: '错误'};
      return '<details class="callout ' + spec.kind + '"' + (/\bopen\b/.test(spec.attrs) ? ' open' : '') + '><summary>' + renderTitle(spec.title || titles[spec.kind], env) + '</summary><div class="callout-body">\n';
    }
  });

  md.block.ruler.before('table', 'cute_table', (state, start, end, silent) => {
    if (state.sCount[start] - state.blkIndent >= 4) return false;
    const line = state.src.slice(state.bMarks[start] + state.tShift[start], state.eMarks[start]);
    const match = line.match(/^::cute-table\{(tuack(?:=[\d, ]+)?|three)\}\s*$/);
    if (!match) return false;
    if (silent) return true;
    const token = state.push('cute_table', '', 0);
    token.content = line;
    token.meta = {style: match[1]};
    token.map = [start, start + 1];
    state.line = start + 1;
    return true;
  }, {alt: ['paragraph', 'reference', 'blockquote', 'list']});
  md.renderer.rules.cute_table = (tokens, idx) => tokens[idx].hidden ? '' : '<p>' + esc(tokens[idx].content) + '</p>\n';

  md.use(markdownitFootnote);
  md.core.ruler.after('inline', 'luogu_metadata', state => {
    const stack = [];
    let heading = 0;
    for (let i = 0; i < state.tokens.length; i++) {
      const token = state.tokens[i];
      if (token.type === 'container_luogu_open') { token.meta = containerSpec(token.info); stack.push(token.meta); }
      if (token.type === 'container_luogu_close') token.meta = stack.pop();
      if (token.type === 'heading_open') token.attrSet('id', 'heading-' + (++heading));
      if (token.type === 'cute_table' && state.tokens[i + 1]?.type === 'table_open') {
        token.hidden = true;
        const table = state.tokens[i + 1];
        table.attrSet('class', 'table-' + token.meta.style.split('=')[0]);
        table.attrSet('data-divider', token.meta.style.split('=')[1] || '');
      }
      if ((token.type === 'th_open' || token.type === 'td_open') && ['^', '<'].includes(state.tokens[i + 1]?.content)) {
        token.attrSet('data-merge', state.tokens[i + 1].content);
      }
      if (token.type === 'inline' && state.tokens[i - 1]?.type === 'paragraph_open' && state.tokens[i - 2]?.type === 'list_item_open') {
        const first = token.children[0];
        const task = first?.type === 'text' && first.content.match(/^\[([ xX])\]\s+/);
        if (task) {
          first.content = first.content.slice(task[0].length);
          const checkbox = new state.Token('html_inline', '', 0);
          checkbox.content = '<input class="task-box" type="checkbox" disabled' + (task[1] !== ' ' ? ' checked' : '') + '>';
          token.children.unshift(checkbox);
          state.tokens[i - 2].attrSet('class', 'task-item');
        }
      }
    }
  });

  function highlightedLines(html) {
    const fragment = document.createElement('template');
    fragment.innerHTML = html;
    const lines = [''], stack = [];
    function visit(node) {
      if (node.nodeType === 3) {
        const parts = node.textContent.split('\n');
        parts.forEach((part, i) => {
          if (i) { lines[lines.length - 1] += '</span>'.repeat(stack.length); lines.push(stack.join('')); }
          lines[lines.length - 1] += esc(part);
        });
      } else if (node.nodeType === 1) {
        const open = '<span class="' + esc(node.className) + '">';
        lines[lines.length - 1] += open; stack.push(open);
        node.childNodes.forEach(visit);
        stack.pop(); lines[lines.length - 1] += '</span>';
      }
    }
    fragment.content.childNodes.forEach(visit);
    return lines;
  }

  md.renderer.rules.fence = (tokens, idx, options, env) => {
    const token = tokens[idx], info = token.info.trim();
    let language = info.split(/\s+/)[0] || 'cpp';
    if (/^(line-numbers|lines=)/.test(language)) language = 'cpp';
    const numbered = /(?:^|\s)line-numbers(?:\s|$)/.test(info);
    const ranges = (info.match(/(?:^|\s)lines=([\d,-]+)/)?.[1] || '').split(',').slice(0, 200).map(part => {
      const [a, b = a] = part.split('-').map(Number);
      return [Math.min(a, b), Math.max(a, b)];
    });
    const code = token.content.replace(/\n$/, '');
    let highlighted = esc(code);
    if (code.length <= 200000 && hljs.getLanguage(language)) {
      try { highlighted = hljs.highlight(code, {language, ignoreIllegals: true}).value; } catch (_) { /* Plain text fallback. */ }
    }
    const lines = highlightedLines(highlighted).map((line, i) => '<span class="code-line' + (ranges.some(([a, b]) => i + 1 >= a && i + 1 <= b) ? ' code-mark' : '') + '" data-line="' + (i + 1) + '">' + (line || '\u200b') + '</span>').join('');
    return '<pre class="code-block' + (numbered ? ' numbered' : '') + '"><code class="hljs language-' + esc(language) + '">' + lines + '</code></pre>\n';
  };

  const originalLink = md.renderer.rules.link_open || ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx], url = token.attrGet('href') || '';
    const user = url.match(/^luogu:\/\/user\/(\d+)$/);
    if (user) token.attrSet('href', 'https://www.luogu.com.cn/user/' + user[1]);
    if (!url.startsWith('#')) { token.attrSet('target', '_blank'); token.attrSet('rel', 'noopener noreferrer'); }
    return originalLink(tokens, idx, options, env, self);
  };

  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    const token = tokens[idx], src = token.attrGet('src') || '';
    const alt = self.renderInlineAsText(token.children || [], options, env);
    const video = src.match(/^bilibili:((?:BV[a-zA-Z\d]+)|(?:av)?\d+)(?:\?(.*))?$/i);
    if (video) {
      const id = /^\d+$/.test(video[1]) ? 'av' + video[1] : video[1];
      const params = new URLSearchParams(video[2] || ''), query = new URLSearchParams();
      const part = params.get('page') || params.get('p');
      if (/^\d+$/.test(part || '')) query.set('p', part);
      if (/^\d+$/.test(params.get('t') || '')) query.set('t', params.get('t'));
      const url = 'https://www.bilibili.com/video/' + id + (query.size ? '?' + query : '');
      return '<span class="video-card"><strong>Bilibili 视频 · ' + esc(alt || id) + '</strong><a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(url) + '</a></span>';
    }
    let dest = src;
    if (!/^(?:https?:|data:image\/(?:png|gif|jpeg|webp|avif);base64,)/i.test(src) && !src.startsWith('//')) {
      dest = env.resolveImage?.(src);
      if (!dest) {
        env.warnings.push('图片未导入：' + src);
        return '<span class="missing-image" data-image-path="' + esc(src) + '">图片未导入：' + esc(alt ? alt + '（' + src + '）' : src) + '</span>';
      }
    }
    if (dest.startsWith('//')) dest = 'https:' + dest;
    return '<img src="' + esc(dest) + '" alt="' + esc(alt) + '"' + (token.attrGet('title') ? ' title="' + esc(token.attrGet('title')) + '"' : '') + ' loading="eager" decoding="async" referrerpolicy="no-referrer">';
  };

  // Merge only rectangular regions. Malformed or formatted markers remain text.
  function mergeTables(root) {
    for (const table of root.querySelectorAll('table')) {
      const dividers = (table.dataset.divider || '').split(',').map(Number);
      for (const group of [...table.children].filter(el => /^(THEAD|TBODY|TFOOT)$/.test(el.tagName))) {
        const grid = [];
        [...group.rows].forEach((row, r) => {
          const cells = [...row.cells]; grid[r] = [];
          for (let c = 0; c < cells.length;) {
            const cell = cells[c], marker = cell.dataset.merge;
            if (marker === '^' && r) {
              const above = grid[r - 1][c];
              const width = above?.width || 0;
              const rectangular = above && above.start === c && c + width <= cells.length &&
                cells.slice(c, c + width).every((el, j) => ['^', '<'].includes(el.dataset.merge) && grid[r - 1][c + j] === above) &&
                cells[c + width]?.dataset.merge !== '<';
              if (rectangular) {
                above.cell.rowSpan++;
                for (let j = 0; j < width; j++) { grid[r][c + j] = above; cells[c + j].remove(); }
                c += width;
                continue;
              }
            }
            let width = 1;
            if (marker !== '<') while (cells[c + width]?.dataset.merge === '<') width++;
            cell.colSpan = width;
            const anchor = {cell, start: c, width};
            for (let j = 0; j < width; j++) { grid[r][c + j] = anchor; if (j) cells[c + j].remove(); }
            if (dividers.includes(c + width)) cell.classList.add('table-divider');
            c += width;
          }
        });
      }
    }
  }

  window.LuoguPDF = {
    render(source, options = {}) {
      const env = {macros: {...defaults}, warnings: [], resolveImage: options.resolveImage};
      const html = md.render(source.replace(/^\uFEFF/, ''), env);
      const root = document.createElement('article');
      root.className = 'document'; root.innerHTML = html;
      mergeTables(root);
      if (options.unlink) root.querySelectorAll('a').forEach(a => a.replaceWith(...a.childNodes));
      return {html: root.innerHTML, warnings: env.warnings};
    },
    escape: esc
  };
})();

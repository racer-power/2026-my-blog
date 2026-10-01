document.addEventListener('DOMContentLoaded', async function () {
  const contentEl = document.getElementById('post-content');
  if (!contentEl) return;

  const params = new URLSearchParams(window.location.search);
  const slug = params.get('post');

  if (!slug) {
    contentEl.innerHTML = '<p class="error">포스트 슬러그가 없습니다. <a href="index.html">목록으로 돌아가기</a></p>';
    return;
  }

  try {
    const res = await fetch('posts/' + encodeURIComponent(slug) + '.md');
    if (!res.ok) throw new Error('포스트를 찾을 수 없습니다. (404)');
    const raw = await res.text();
    const parsed = parseFrontmatter(raw);
    const meta = parsed.meta;
    const body = parsed.body;

    if (meta.title) {
      document.title = escapeHtml(meta.title) + ' - My Blog';
    }

    const tagsHtml = meta.tags && meta.tags.length
      ? '<div class="post-tags">' +
          meta.tags.map(function (t) { return '<span class="tag">' + escapeHtml(t) + '</span>'; }).join('') +
        '</div>'
      : '';

    const dateHtml = meta.date
      ? '<time datetime="' + escapeHtml(meta.date) + '">' + formatDate(meta.date) + '</time>'
      : '';

    contentEl.innerHTML =
      '<header class="post-header">' +
        '<h1 class="post-title">' + escapeHtml(meta.title || '제목 없음') + '</h1>' +
        '<div class="post-meta">' + dateHtml + tagsHtml + '</div>' +
      '</header>' +
      '<div class="post-body">' + marked.parse(body) + '</div>';

  } catch (err) {
    contentEl.innerHTML = '<p class="error">' + escapeHtml(err.message) + '</p>';
  }
});

function parseFrontmatter(raw) {
  var match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };

  var meta = {};
  var lines = match[1].split('\n');
  var body = match[2];

  lines.forEach(function (line) {
    var colonIdx = line.indexOf(':');
    if (colonIdx === -1) return;
    var key = line.slice(0, colonIdx).trim();
    var val = line.slice(colonIdx + 1).trim();

    if (val.startsWith('[') && val.endsWith(']')) {
      meta[key] = val.slice(1, -1).split(',').map(function (v) {
        return v.trim().replace(/^['"]|['"]$/g, '');
      }).filter(Boolean);
    } else {
      meta[key] = val.replace(/^['"]|['"]$/g, '');
    }
  });

  return { meta: meta, body: body };
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(dateStr) {
  var d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

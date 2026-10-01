document.addEventListener('DOMContentLoaded', async function () {
  const listEl = document.getElementById('post-list');
  if (!listEl) return;

  try {
    const res = await fetch('posts/index.json');
    if (!res.ok) throw new Error('포스트 목록을 불러올 수 없습니다.');
    const posts = await res.json();

    if (!posts.length) {
      listEl.innerHTML = '<p class="empty">아직 작성된 포스트가 없습니다.</p>';
      return;
    }

    listEl.innerHTML = posts.map(function (post) {
      const tagsHtml = post.tags && post.tags.length
        ? '<div class="post-card__tags">' +
            post.tags.map(function (t) { return '<span class="tag">' + escapeHtml(t) + '</span>'; }).join('') +
          '</div>'
        : '';
      const descHtml = post.description
        ? '<p class="post-card__desc">' + escapeHtml(post.description) + '</p>'
        : '';
      return (
        '<article class="post-card" role="listitem">' +
          '<a href="post.html?post=' + encodeURIComponent(post.slug) + '" class="post-card__link">' +
            '<h2 class="post-card__title">' + escapeHtml(post.title) + '</h2>' +
          '</a>' +
          '<div class="post-card__meta">' +
            '<time datetime="' + escapeHtml(post.date) + '">' + formatDate(post.date) + '</time>' +
            tagsHtml +
          '</div>' +
          descHtml +
        '</article>'
      );
    }).join('');
  } catch (err) {
    listEl.innerHTML = '<p class="error">' + escapeHtml(err.message) + '</p>';
  }
});

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

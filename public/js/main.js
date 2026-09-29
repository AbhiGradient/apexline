(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = (value) =>
    String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const toast = (message, type = 'success') => {
    let stack = $('.toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'toast-stack';
      stack.setAttribute('aria-live', 'polite');
      document.body.appendChild(stack);
    }
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    stack.appendChild(el);
    setTimeout(() => el.classList.add('is-leaving'), 3200);
    setTimeout(() => el.remove(), 3700);
  };

  const setBadge = (name, count) => {
    $$(`[data-badge="${name}"]`).forEach((badge) => {
      badge.textContent = count;
      badge.hidden = !count;
    });
  };

  let tokenPromise = null;
  const getToken = () => {
    if (!tokenPromise) {
      tokenPromise = fetch('/api/csrf', { credentials: 'same-origin' })
        .then((res) => res.json())
        .then((data) => data.token);
    }
    return tokenPromise;
  };

  const dropdowns = $$('[data-dropdown]');
  const closeDropdowns = (except) =>
    dropdowns.forEach((dropdown) => {
      if (dropdown === except) return;
      dropdown.classList.remove('open');
      const toggle = $('[data-dropdown-toggle]', dropdown);
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    });

  dropdowns.forEach((dropdown) => {
    const toggle = $('[data-dropdown-toggle]', dropdown);
    if (!toggle) return;
    toggle.addEventListener('click', (event) => {
      event.stopPropagation();
      closeDropdowns(dropdown);
      const open = dropdown.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
  });
  document.addEventListener('click', () => closeDropdowns());
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeDropdowns();
  });

  const searchInput = $('[data-search-input]');
  const suggestBox = $('[data-search-suggest]');
  if (searchInput && suggestBox) {
    let timer;
    let controller;
    let index = -1;

    const hide = () => {
      suggestBox.hidden = true;
      suggestBox.innerHTML = '';
      index = -1;
    };

    const highlight = () => {
      $$('a', suggestBox).forEach((link, i) => link.classList.toggle('is-active', i === index));
    };

    const render = (items) => {
      if (!items.length) return hide();
      suggestBox.innerHTML = items
        .map((item) => `<a role="option" href="${esc(item.url)}"><span>${esc(item.label)}</span><small>${esc(item.type)}</small></a>`)
        .join('');
      suggestBox.hidden = false;
      index = -1;
    };

    searchInput.addEventListener('input', () => {
      const term = searchInput.value.trim();
      clearTimeout(timer);
      if (term.length < 2) return hide();
      timer = setTimeout(async () => {
        if (controller) controller.abort();
        controller = new AbortController();
        try {
          const res = await fetch(`/api/suggest?q=${encodeURIComponent(term)}`, { signal: controller.signal });
          render(await res.json());
        } catch (err) {
          if (err.name !== 'AbortError') hide();
        }
      }, 180);
    });

    searchInput.addEventListener('keydown', (event) => {
      const links = $$('a', suggestBox);
      if (suggestBox.hidden || !links.length) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        index = (index + 1) % links.length;
        highlight();
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        index = (index - 1 + links.length) % links.length;
        highlight();
      } else if (event.key === 'Enter' && index >= 0) {
        event.preventDefault();
        window.location.href = links[index].href;
      } else if (event.key === 'Escape') {
        hide();
      }
    });

    document.addEventListener('click', (event) => {
      if (!event.target.closest('.search')) hide();
    });
  }

  document.addEventListener('submit', (event) => {
    const form = event.target.closest('form[data-confirm]');
    if (form && !window.confirm(form.dataset.confirm)) event.preventDefault();
  });

  document.addEventListener('submit', async (event) => {
    const form = event.target.closest('form[data-ajax-form]');
    if (!form) return;
    event.preventDefault();

    const button = $('button[type="submit"], button:not([type])', form);
    if (button) button.disabled = true;

    try {
      const body = new URLSearchParams(new FormData(form));
      if (!body.has('_csrf')) body.set('_csrf', await getToken());

      const res = await fetch(form.action, {
        method: 'POST',
        body,
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'X-Requested-With': 'fetch' }
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 403) tokenPromise = null;
      if (data.redirect) {
        window.location.href = data.redirect;
        return;
      }
      if (typeof data.cartCount === 'number') setBadge('cart', data.cartCount);
      if (typeof data.wishCount === 'number') setBadge('wish', data.wishCount);
      if (typeof data.active === 'boolean') form.classList.toggle('is-active', data.active);
      if (data.reset) form.reset();

      const message = data.message || (res.ok ? '' : 'Something went wrong. Please refresh and try again.');
      if (message) toast(message, res.ok && data.ok !== false ? 'success' : 'error');
    } catch (err) {
      toast('Network problem. Please try again.', 'error');
    } finally {
      if (button) button.disabled = false;
    }
  });

  document.addEventListener('click', (event) => {
    const step = event.target.closest('[data-qty-step]');
    if (step) {
      const box = step.closest('[data-qty]');
      const input = $('input', box);
      const max = Number(input.max) || 99;
      const next = Math.min(max, Math.max(1, (Number(input.value) || 1) + Number(step.dataset.qtyStep)));
      input.value = next;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    const thumb = event.target.closest('[data-gallery-thumb]');
    if (thumb) {
      const main = $('[data-gallery-main]');
      if (main) {
        main.src = thumb.dataset.src;
        main.alt = thumb.dataset.alt || main.alt;
      }
      $$('[data-gallery-thumb]').forEach((el) => el.classList.toggle('is-active', el === thumb));
      return;
    }

    if (event.target.closest('.flash-close')) {
      event.target.closest('.flash').remove();
      return;
    }

    const top = event.target.closest('[data-back-top]');
    if (top) {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
document.addEventListener('change', (event) => {
  const input = event.target.closest('[data-qty] input');
  if (input) $$('input[data-qty-mirror]').forEach((mirror) => { mirror.value = input.value; });
});

document.addEventListener('change', (event) => {
  const select = event.target.closest('[data-autosubmit]');
  if (select && select.form) select.form.submit();
});

  document.addEventListener('change', (event) => {
    const select = event.target.closest('[data-autosubmit]');
    if (select && select.form) select.form.submit();
  });

  document.addEventListener(
    'error',
    (event) => {
      const img = event.target;
      if (img.tagName === 'IMG' && !img.dataset.fallbackDone) {
        img.dataset.fallbackDone = '1';
        img.src = '/images/placeholder.svg';
      }
    },
    true
  );

  const flash = $('.flash');
  if (flash) setTimeout(() => flash.remove(), 7000);
})();
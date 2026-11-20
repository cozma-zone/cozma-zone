/* Kuwait Cosma checkout + Snapchat Pixel events. */
const CONFIG = {
  scriptUrl: 'https://script.google.com/macros/s/AKfycbxxBGHE4mZ5iDdplvvaFxVhrHoOMETyRoafgk8iG-DGx9vhY27JgFhc3VHFBO22hu4x0w/exec',
  product: 'Cosma Collagen Kuwait',
  sku: 'COSMA-COLLAGEN-KW',
  country: 'KW',
  currency: 'KWD',
  offers: [
    { label: 'باقة البداية — 1 عبوة', price: 19, quantity: 1 },
    { label: 'باقة التوفير — 2 عبوة', price: 25, quantity: 2 },
    { label: 'الباقة الذهبية — 3 عبوات', price: 29, quantity: 3 }
  ]
};

function snapTrack(eventName, params) {
  if (typeof window.snaptr === 'function') {
    try {
      window.snaptr('track', eventName, params || {});
    } catch (error) {
      console.warn('Snap Pixel event failed:', eventName, error);
    }
  }
}

const form = document.getElementById('order-form');
const message = document.getElementById('form-message');

// Standard page and product-view events.
snapTrack('PAGE_VIEW');
snapTrack('VIEW_CONTENT', {
  item_ids: [CONFIG.sku],
  item_category: 'Beauty & Personal Care',
  currency: CONFIG.currency
});

function kuwaitPhone(value) {
  let phone = String(value || '')
    .replace(/[٠-٩]/g, digit => '٠١٢٣٤٥٦٧٨٩'.indexOf(digit))
    .replace(/[۰-۹]/g, digit => '۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))
    .replace(/[\\s()+-]/g, '');

  if (phone.startsWith('00965')) phone = phone.slice(5);
  else if (phone.startsWith('965')) phone = phone.slice(3);

  return /^[24569][0-9]{7}$/.test(phone) ? '+965' + phone : null;
}

function selectedOffer() {
  if (!form) return null;
  const selected = form.querySelector('input[name="offer"]:checked');
  return selected ? CONFIG.offers[Number(selected.value) - 1] || null : null;
}

// Add to cart when the visitor selects a package.
if (form) {
  form.querySelectorAll('input[name="offer"]').forEach(function (radio) {
    radio.addEventListener('change', function () {
      const offer = selectedOffer();
      if (!offer) return;
      snapTrack('ADD_CART', {
        item_ids: [CONFIG.sku],
        item_category: 'Beauty & Personal Care',
        number_items: offer.quantity,
        price: offer.price,
        currency: CONFIG.currency
      });
    });
  });
}

if (form && message) {
  // Handle validation ourselves so the browser never performs a native form navigation.
  form.noValidate = true;

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    message.textContent = '';
    message.style.color = '#ad343f';

    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    const phone = kuwaitPhone(data.get('phone'));
    const address = String(data.get('address') || '').trim();
    const offerCode = Number(data.get('offer'));

    if (name.length < 2) {
      message.textContent = 'يرجى إدخال الاسم الكامل.';
      form.elements.name.focus();
      return;
    }

    if (!phone) {
      message.textContent = 'يرجى إدخال رقم هاتف كويتي صحيح من 8 أرقام.';
      form.elements.phone.focus();
      return;
    }

    if (address.length < 4) {
      message.textContent = 'يرجى إدخال عنوان التوصيل بالتفصيل.';
      form.elements.address.focus();
      return;
    }

    const offer = CONFIG.offers[offerCode - 1];
    if (!offer) {
      message.textContent = 'يرجى اختيار الباقة.';
      return;
    }

    const button = form.querySelector('.submit');
    if (button.disabled) return;

    const transactionId = 'COSMA-KW-' + Date.now();
    const payload = {
      product: CONFIG.product,
      sku: CONFIG.sku,
      productSku: CONFIG.sku,
      country: CONFIG.country,
      currency: CONFIG.currency,
      name: name,
      phone: phone,
      address: address,
      offerCode: offerCode,
      offer: offer.label,
      price: offer.price,
      transactionId: transactionId,
      transaction_id: transactionId,
      pageUrl: window.location.href,
      source: 'Cosma Kuwait Landing Page',
      utm: Object.fromEntries(new URLSearchParams(window.location.search))
    };

    button.disabled = true;
    button.textContent = 'جارٍ إرسال طلبك…';
    message.textContent = 'يتم إرسال بيانات طلبك، يرجى الانتظار وعدم إغلاق الصفحة.';
    message.style.color = '#17324f';

    try {
      // Apps Script ContentService uses a cross-origin redirect; no-cors allows the POST.
      // The opaque response does not confirm that the order was written to Google Sheets.
      await fetch(CONFIG.scriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        credentials: 'omit',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });

      // Purchase event fires once per transaction after the browser POST completes.
      // This is not server-side confirmation because the no-cors response is opaque.
      const purchaseKey = 'snap-purchase-' + transactionId;
      if (!sessionStorage.getItem(purchaseKey)) {
        snapTrack('PURCHASE', {
          item_ids: [CONFIG.sku],
          item_category: 'Beauty & Personal Care',
          number_items: offer.quantity,
          price: offer.price,
          currency: CONFIG.currency,
          transaction_id: transactionId
        });
        sessionStorage.setItem(purchaseKey, '1');
      }

      form.innerHTML =
        '<div class="success" role="status" aria-live="polite">' +
        '<span>✓</span>' +
        '<h2>تم إرسال طلبك</h2>' +
        '<p>شكراً لك. سنتواصل معك هاتفياً لتأكيد الطلب.</p>' +
        '<small>رقم الطلب: ' + transactionId + '</small>' +
        '</div>';

    } catch (error) {
      console.error('Cosma Kuwait order submission failed:', error);
      message.textContent = 'تعذر إرسال الطلب بسبب مشكلة اتصال. بياناتك لم تُؤكد؛ يرجى المحاولة مرة أخرى.';
      button.disabled = false;
      button.textContent = 'إرسال الطلب — الدفع عند الاستلام';
    }
  }, true);
}

// Keep the sticky CTA separate from the checkout form.
const sticky = document.querySelector('.sticky-order');
const section = document.getElementById('order');

if (sticky && section) {
  const updateSticky = function () {
    const rect = section.getBoundingClientRect();
    sticky.classList.toggle(
      'is-hidden',
      rect.top < window.innerHeight * 0.9 &&
      rect.bottom > window.innerHeight * 0.1
    );
  };

  sticky.addEventListener('click', function (event) {
    event.preventDefault();
    snapTrack('START_CHECKOUT', {
      item_ids: [CONFIG.sku],
      item_category: 'Beauty & Personal Care',
      currency: CONFIG.currency
    });
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  window.addEventListener('scroll', updateSticky, { passive: true });
  window.addEventListener('resize', updateSticky);
  window.addEventListener('pageshow', updateSticky);
  requestAnimationFrame(updateSticky);
}

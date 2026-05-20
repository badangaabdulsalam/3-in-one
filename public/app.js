const currency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0
});

const STORAGE_KEY = "pivot-devs-demo-cart-v1";
const TAX_RATE = 0.07;
const SHIPPING_FLAT = 16000;
const FREE_SHIPPING_THRESHOLD = 288000;
const LOCAL_IMAGE_FALLBACK = "/images/product-fallback.svg";

const state = {
  products: [],
  filteredProducts: [],
  categories: ["All"],
  cart: loadCart(),
  filters: {
    search: "",
    category: "All",
    sort: "featured"
  },
  checkoutPending: false,
  themeIndex: 0
};

const themePresets = [
  {
    "--bg-1": "#06080f",
    "--bg-2": "#213205",
    "--bg-3": "#024450",
    "--accent": "#d4ff36",
    "--accent-2": "#ff7a2f",
    "--accent-3": "#1ff1ff"
  },
  {
    "--bg-1": "#130a04",
    "--bg-2": "#3a2202",
    "--bg-3": "#0b5963",
    "--accent": "#ffd43b",
    "--accent-2": "#ff5531",
    "--accent-3": "#68f8ff"
  },
  {
    "--bg-1": "#03120f",
    "--bg-2": "#064c2f",
    "--bg-3": "#0a2d47",
    "--accent": "#c8ff45",
    "--accent-2": "#ff8b2d",
    "--accent-3": "#2af4c9"
  }
];

const els = {
  searchInput: document.querySelector("#searchInput"),
  categorySelect: document.querySelector("#categorySelect"),
  sortSelect: document.querySelector("#sortSelect"),
  surpriseButton: document.querySelector("#surpriseButton"),
  resultsMeta: document.querySelector("#resultsMeta"),
  catalog: document.querySelector("#catalog"),
  cartToggle: document.querySelector("#cartToggle"),
  closeCart: document.querySelector("#closeCart"),
  cartPanel: document.querySelector("#cartPanel"),
  backdrop: document.querySelector("#backdrop"),
  cartCount: document.querySelector("#cartCount"),
  cartItems: document.querySelector("#cartItems"),
  cartSummary: document.querySelector("#cartSummary"),
  checkoutForm: document.querySelector("#checkoutForm"),
  checkoutMessage: document.querySelector("#checkoutMessage"),
  trackOrderForm: document.querySelector("#trackOrderForm"),
  trackOrderId: document.querySelector("#trackOrderId"),
  trackOrderResult: document.querySelector("#trackOrderResult"),
  toastHost: document.querySelector("#toastHost"),
  startShopping: document.querySelector("#startShopping"),
  catalogSection: document.querySelector("#catalogSection"),
  shuffleTheme: document.querySelector("#shuffleTheme")
};

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  renderCart();
  fetchAndRenderProducts();
});

function bindEvents() {
  els.searchInput?.addEventListener("input", (event) => {
    state.filters.search = event.target.value.trim().toLowerCase();
    applyFilters();
  });

  els.categorySelect?.addEventListener("change", (event) => {
    state.filters.category = event.target.value;
    applyFilters();
  });

  els.sortSelect?.addEventListener("change", (event) => {
    state.filters.sort = event.target.value;
    applyFilters();
  });

  els.surpriseButton?.addEventListener("click", () => {
    const pool = state.filteredProducts.length ? state.filteredProducts : state.products;
    if (!pool.length) {
      notify("No products to surprise you with yet.", "error");
      return;
    }

    const randomItem = pool[Math.floor(Math.random() * pool.length)];
    const card = document.querySelector(`[data-product-id="${randomItem.id}"]`);
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      card.animate(
        [
          { transform: "scale(1)", boxShadow: "0 10px 20px rgba(0,0,0,0.25)" },
          { transform: "scale(1.025)", boxShadow: "0 20px 45px rgba(31, 241, 255, 0.35)" },
          { transform: "scale(1)", boxShadow: "0 10px 20px rgba(0,0,0,0.25)" }
        ],
        { duration: 680 }
      );
    }

    notify(`Surprise pick: ${randomItem.name}`, "success");
  });

  els.cartToggle?.addEventListener("click", openCart);
  els.closeCart?.addEventListener("click", closeCart);
  els.backdrop?.addEventListener("click", closeCart);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeCart();
    }
  });

  els.checkoutForm?.addEventListener("submit", handleCheckout);
  els.trackOrderForm?.addEventListener("submit", handleTrackOrder);

  els.startShopping?.addEventListener("click", () => {
    els.catalogSection?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  els.shuffleTheme?.addEventListener("click", () => {
    state.themeIndex = (state.themeIndex + 1) % themePresets.length;
    applyTheme(themePresets[state.themeIndex]);
    notify("Vibe switched. Keep shopping.", "success");
  });
}

async function fetchAndRenderProducts() {
  try {
    const response = await fetch("/products.json");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data || typeof data !== "object") {
      throw new Error("Invalid response data format");
    }
    
    state.products = Array.isArray(data.items) ? data.items : [];
    state.categories = ["All", ...(data.categories || [])];

    renderCategoryOptions();
    syncCartWithInventory();
    applyFilters();
    renderCart();
  } catch (error) {
    console.error("Product fetch error:", error);
    renderCatalogError(error.message);
  }
}

function syncCartWithInventory() {
  const nextCart = [];

  for (const line of state.cart) {
    const product = findProduct(line.productId);
    if (!product || product.stock <= 0) {
      continue;
    }

    nextCart.push({
      productId: line.productId,
      quantity: Math.min(line.quantity, product.stock)
    });
  }

  state.cart = nextCart;
  persistCart();
}

function renderCategoryOptions() {
  if (!els.categorySelect) return;

  const currentValue = state.filters.category;
  els.categorySelect.innerHTML = "";

  for (const category of state.categories) {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    if (category === currentValue) {
      option.selected = true;
    }
    els.categorySelect.append(option);
  }
}

function applyFilters() {
  let products = [...state.products];

  if (state.filters.category !== "All") {
    products = products.filter((product) => product.category === state.filters.category);
  }

  if (state.filters.search) {
    const needle = state.filters.search;
    products = products.filter((product) => {
      const haystack = `${product.name} ${product.description} ${product.category}`.toLowerCase();
      return haystack.includes(needle);
    });
  }

  products = sortProducts(products, state.filters.sort);
  state.filteredProducts = products;

  renderProducts(products);
  renderResultsMeta(products.length);
}

function sortProducts(products, sortMode) {
  const items = [...products];
  switch (sortMode) {
    case "price-asc":
      items.sort((a, b) => a.price - b.price);
      break;
    case "price-desc":
      items.sort((a, b) => b.price - a.price);
      break;
    case "name-asc":
      items.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "rating-desc":
      items.sort((a, b) => b.rating - a.rating);
      break;
    default:
      items.sort((a, b) => Number(b.featured) - Number(a.featured) || b.rating - a.rating);
  }
  return items;
}

function renderProducts(products) {
  if (!els.catalog) return;

  els.catalog.innerHTML = "";

  if (!products.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No products match this filter. Try another vibe.";
    els.catalog.append(empty);
    return;
  }

  const fragment = document.createDocumentFragment();

  products.forEach((product, index) => {
    const card = document.createElement("article");
    card.className = "product-card";
    card.dataset.productId = product.id;
    card.style.setProperty("--delay", `${Math.min(index * 28, 500)}ms`);

    const image = document.createElement("img");
    image.src = product.image || product.fallbackImage || LOCAL_IMAGE_FALLBACK;
    image.alt = product.name;
    image.loading = "lazy";
    image.addEventListener("error", () => {
      if (image.dataset.fallbackTried === "1") {
        image.src = LOCAL_IMAGE_FALLBACK;
        return;
      }

      image.dataset.fallbackTried = "1";
      image.src = product.fallbackImage || LOCAL_IMAGE_FALLBACK;
    });

    const body = document.createElement("div");
    body.className = "product-body";

    const badges = document.createElement("div");
    badges.className = "badges";

    const categoryBadge = document.createElement("span");
    categoryBadge.className = "badge";
    categoryBadge.textContent = product.category;
    badges.append(categoryBadge);

    if (product.featured) {
      const featuredBadge = document.createElement("span");
      featuredBadge.className = "badge featured";
      featuredBadge.textContent = "Featured";
      badges.append(featuredBadge);
    }

    const title = document.createElement("h3");
    title.className = "product-title";
    title.textContent = product.name;

    const desc = document.createElement("p");
    desc.className = "product-desc";
    desc.textContent = product.description;

    const priceRow = document.createElement("div");
    priceRow.className = "price-row";

    const price = document.createElement("strong");
    price.textContent = currency.format(product.price);

    const rating = document.createElement("span");
    rating.textContent = `${product.rating.toFixed(1)} / 5`;

    priceRow.append(price, rating);

    const stock = document.createElement("p");
    stock.className = "stock-text";
    stock.textContent = product.stock > 0 ? `${product.stock} left in stock` : "Sold out";

    const addButton = document.createElement("button");
    addButton.className = "btn btn-primary btn-full";
    addButton.type = "button";
    addButton.textContent = product.stock > 0 ? "Add to Cart" : "Sold Out";
    addButton.disabled = product.stock <= 0;
    addButton.addEventListener("click", () => {
      addToCart(product.id);
    });

    body.append(badges, title, desc, priceRow, stock, addButton);
    card.append(image, body);
    fragment.append(card);
  });

  els.catalog.append(fragment);
}

function renderResultsMeta(resultCount) {
  if (!els.resultsMeta) return;
  const total = state.products.length;
  els.resultsMeta.textContent = `Showing ${resultCount} of ${total} products.`;
}

function renderCatalogError(message) {
  if (!els.catalog) return;
  els.catalog.innerHTML = "";
  const error = document.createElement("div");
  error.className = "empty-state";
  error.textContent = message || "Could not load products.";
  els.catalog.append(error);
  if (els.resultsMeta) {
    els.resultsMeta.textContent = "Catalog unavailable";
  }
}

function addToCart(productId) {
  const product = findProduct(productId);
  if (!product) {
    notify("Product was not found.", "error");
    return;
  }

  if (product.stock <= 0) {
    notify("This product is sold out.", "error");
    return;
  }

  const line = state.cart.find((item) => item.productId === productId);
  if (line) {
    if (line.quantity >= product.stock) {
      notify("You reached available stock for this item.", "error");
      return;
    }
    line.quantity += 1;
  } else {
    state.cart.push({ productId, quantity: 1 });
  }

  persistCart();
  renderCart();
  notify(`${product.name} added to cart.`, "success");
}

function updateCartQuantity(productId, nextQuantity) {
  const product = findProduct(productId);
  if (!product) return;

  const line = state.cart.find((item) => item.productId === productId);
  if (!line) return;

  if (nextQuantity <= 0) {
    state.cart = state.cart.filter((item) => item.productId !== productId);
  } else {
    line.quantity = Math.max(1, Math.min(nextQuantity, product.stock));
  }

  persistCart();
  renderCart();
}

function removeFromCart(productId) {
  state.cart = state.cart.filter((item) => item.productId !== productId);
  persistCart();
  renderCart();
}

function renderCart() {
  if (!els.cartItems || !els.cartSummary || !els.cartCount) return;

  const cartCount = state.cart.reduce((sum, line) => sum + line.quantity, 0);
  els.cartCount.textContent = String(cartCount);

  els.cartItems.innerHTML = "";

  if (!state.cart.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Your cart is empty. Pick something loud.";
    els.cartItems.append(empty);
  } else {
    for (const line of state.cart) {
      const product = findProduct(line.productId);
      if (!product) continue;

      const row = document.createElement("article");
      row.className = "cart-item";

      const image = document.createElement("img");
      image.src = product.image || product.fallbackImage || LOCAL_IMAGE_FALLBACK;
      image.alt = product.name;
      image.loading = "lazy";
      image.addEventListener("error", () => {
        if (image.dataset.fallbackTried === "1") {
          image.src = LOCAL_IMAGE_FALLBACK;
          return;
        }

        image.dataset.fallbackTried = "1";
        image.src = product.fallbackImage || LOCAL_IMAGE_FALLBACK;
      });

      const content = document.createElement("div");

      const title = document.createElement("h4");
      title.textContent = product.name;

      const sub = document.createElement("p");
      sub.className = "cart-line-sub";
      sub.textContent = `${currency.format(product.price)} each`;

      const controlsWrap = document.createElement("div");
      controlsWrap.className = "cart-line-actions";

      const qty = document.createElement("div");
      qty.className = "qty-controls";

      const minus = document.createElement("button");
      minus.type = "button";
      minus.textContent = "-";
      minus.addEventListener("click", () => updateCartQuantity(product.id, line.quantity - 1));

      const qtyText = document.createElement("span");
      qtyText.textContent = String(line.quantity);

      const plus = document.createElement("button");
      plus.type = "button";
      plus.textContent = "+";
      plus.addEventListener("click", () => updateCartQuantity(product.id, line.quantity + 1));

      qty.append(minus, qtyText, plus);

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "remove-line";
      remove.textContent = "Remove";
      remove.addEventListener("click", () => removeFromCart(product.id));

      controlsWrap.append(qty, remove);
      content.append(title, sub, controlsWrap);

      row.append(image, content);
      els.cartItems.append(row);
    }
  }

  const totals = estimateTotals();
  els.cartSummary.innerHTML = `
    <div><span>Subtotal</span><span>${currency.format(totals.subtotal)}</span></div>
    <div><span>Shipping</span><span>${currency.format(totals.shipping)}</span></div>
    <div><span>Tax</span><span>${currency.format(totals.tax)}</span></div>
    <div><strong>Total</strong><strong>${currency.format(totals.total)}</strong></div>
  `;
}

function estimateTotals() {
  const subtotal = state.cart.reduce((sum, line) => {
    const product = findProduct(line.productId);
    if (!product) return sum;
    return sum + product.price * line.quantity;
  }, 0);

  const roundedSubtotal = roundMoney(subtotal);
  const shipping = roundedSubtotal >= FREE_SHIPPING_THRESHOLD || roundedSubtotal === 0 ? 0 : SHIPPING_FLAT;
  const tax = roundMoney(roundedSubtotal * TAX_RATE);
  const total = roundMoney(roundedSubtotal + shipping + tax);

  return {
    subtotal: roundedSubtotal,
    shipping,
    tax,
    total
  };
}

async function handleCheckout(event) {
  event.preventDefault();

  if (state.checkoutPending) {
    return;
  }

  if (!state.cart.length) {
    setCheckoutMessage("Your cart is empty.", true);
    return;
  }

  if (!els.checkoutForm.reportValidity()) {
    return;
  }

  const formData = new FormData(els.checkoutForm);
  const customer = {
    name: String(formData.get("name") || "").trim(),
    email: String(formData.get("email") || "").trim(),
    phone: String(formData.get("phone") || "").trim(),
    address1: String(formData.get("address1") || "").trim(),
    address2: String(formData.get("address2") || "").trim(),
    city: String(formData.get("city") || "").trim(),
    country: String(formData.get("country") || "").trim(),
    postalCode: String(formData.get("postalCode") || "").trim()
  };

  const payload = {
    customer,
    notes: String(formData.get("notes") || "").trim(),
    cart: state.cart.map((line) => ({
      productId: line.productId,
      quantity: line.quantity
    })),
    totals: estimateTotals()
  };

  state.checkoutPending = true;
  setCheckoutMessage("Placing your order...", false);

  try {
    const response = await fetch("/.netlify/functions/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Checkout failed.");
    }

    state.cart = [];
    persistCart();
    renderCart();

    els.checkoutForm.reset();
    setCheckoutMessage(`Order placed: ${result.id}`, false);
    notify(`Order confirmed: ${result.id}`, "success");

    if (els.trackOrderId) {
      els.trackOrderId.value = result.id;
    }
    renderTrackedOrder(result);

    launchConfettiBurst();

    await fetchAndRenderProducts();
  } catch (error) {
    setCheckoutMessage(error.message || "Checkout failed.", true);
    notify(error.message || "Checkout failed.", "error");
  } finally {
    state.checkoutPending = false;
  }
}

async function handleTrackOrder(event) {
  event.preventDefault();
  if (els.trackOrderResult) {
    els.trackOrderResult.textContent = "Order tracking is not available on this Netlify deployment.";
  }
}

function renderTrackedOrder(order) {
  if (!els.trackOrderResult) return;

  const itemCount = order.items.reduce((sum, line) => sum + line.quantity, 0);
  const eta = typeof order.etaDays === "number" ? `${order.etaDays} days` : "soon";

  els.trackOrderResult.innerHTML = `
    <div class="receipt-brand">
      <img src="/images/pivot-devs-logo.svg" alt="Pivot Devs Demo logo" />
      <div>
        <strong>Pivot Devs Demo</strong>
        <span>Order receipt</span>
      </div>
    </div>
    <div class="receipt-grid">
      <div><span>Order ID</span><strong>${order.id}</strong></div>
      <div><span>Status</span><strong>${order.status}</strong></div>
      <div><span>Items</span><strong>${itemCount}</strong></div>
      <div><span>Total</span><strong>${currency.format(order.totals.total)}</strong></div>
      <div><span>ETA</span><strong>${eta}</strong></div>
    </div>
  `;
}

function openCart() {
  if (!els.cartPanel || !els.backdrop) return;
  els.cartPanel.classList.add("open");
  els.cartPanel.setAttribute("aria-hidden", "false");
  els.backdrop.hidden = false;
}

function closeCart() {
  if (!els.cartPanel || !els.backdrop) return;
  els.cartPanel.classList.remove("open");
  els.cartPanel.setAttribute("aria-hidden", "true");
  els.backdrop.hidden = true;
}

function applyTheme(themeMap) {
  const root = document.documentElement;
  for (const [variable, value] of Object.entries(themeMap)) {
    root.style.setProperty(variable, value);
  }
}

function notify(message, type = "success") {
  if (!els.toastHost) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;

  els.toastHost.append(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 2800);
}

function setCheckoutMessage(message, isError) {
  if (!els.checkoutMessage) return;
  els.checkoutMessage.textContent = message;
  els.checkoutMessage.style.color = isError ? "var(--danger)" : "var(--accent-3)";
}

function findProduct(productId) {
  return state.products.find((item) => item.id === productId);
}

function roundMoney(value) {
  return Number(value.toFixed(2));
}

function persistCart() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.cart));
}

function loadCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((line) => line && typeof line.productId === "string" && Number.isInteger(line.quantity) && line.quantity > 0)
      .map((line) => ({ productId: line.productId, quantity: line.quantity }));
  } catch {
    return [];
  }
}

function launchConfettiBurst() {
  for (let i = 0; i < 20; i += 1) {
    const confetti = document.createElement("span");
    confetti.style.position = "fixed";
    confetti.style.width = "10px";
    confetti.style.height = "10px";
    confetti.style.left = `${Math.random() * 100}%`;
    confetti.style.top = "-12px";
    confetti.style.zIndex = "50";
    confetti.style.background = i % 3 === 0 ? "var(--accent)" : i % 3 === 1 ? "var(--accent-2)" : "var(--accent-3)";
    confetti.style.transform = `rotate(${Math.random() * 180}deg)`;
    confetti.style.transition = `transform 1200ms ease-out, top 1200ms ease-out, opacity 1200ms ease-out`;
    document.body.append(confetti);

    requestAnimationFrame(() => {
      confetti.style.top = `${75 + Math.random() * 25}%`;
      confetti.style.transform = `translateX(${(Math.random() - 0.5) * 220}px) rotate(${Math.random() * 520}deg)`;
      confetti.style.opacity = "0";
    });

    window.setTimeout(() => {
      confetti.remove();
    }, 1300);
  }
}

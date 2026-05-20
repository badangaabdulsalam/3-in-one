const SENDGRID_API = "https://api.sendgrid.com/v3/mail/send";

function roundMoney(value) {
  return Number(value.toFixed(2));
}

function estimateTotals(items, productsMap) {
  const subtotal = items.reduce((sum, line) => {
    const p = productsMap[line.productId];
    const price = p ? Number(p.price) : 0;
    return sum + price * line.quantity;
  }, 0);

  const TAX_RATE = 0.07;
  const SHIPPING_FLAT = 16000;
  const FREE_SHIPPING_THRESHOLD = 288000;

  const roundedSubtotal = roundMoney(subtotal);
  const shipping = roundedSubtotal >= FREE_SHIPPING_THRESHOLD || roundedSubtotal === 0 ? 0 : SHIPPING_FLAT;
  const tax = roundMoney(roundedSubtotal * TAX_RATE);
  const total = roundMoney(roundedSubtotal + shipping + tax);

  return { subtotal: roundedSubtotal, shipping, tax, total };
}

function buildPlainTextEmail(orderId, customer, notes, items, totals, productsMap) {
  let lines = [];
  lines.push(`Order ID: ${orderId}`);
  lines.push(`Name: ${customer.name}`);
  lines.push(`Email: ${customer.email}`);
  lines.push(`Phone: ${customer.phone}`);
  lines.push(`Address: ${customer.address1} ${customer.address2} ${customer.city} ${customer.postalCode} ${customer.country}`);
  lines.push(`Notes: ${notes}`);
  lines.push('');
  lines.push('Items:');

  for (const line of items) {
    const p = productsMap[line.productId];
    const title = p ? p.name : line.productId;
    const price = p ? currencyFormatter(p.price) : 'N/A';
    lines.push(`- ${title} (${line.productId}) x${line.quantity} @ ${price}`);
  }

  lines.push('');
  lines.push(`Subtotal: ${currencyFormatter(totals.subtotal)}`);
  lines.push(`Shipping: ${currencyFormatter(totals.shipping)}`);
  lines.push(`Tax: ${currencyFormatter(totals.tax)}`);
  lines.push(`Total: ${currencyFormatter(totals.total)}`);

  return lines.join('\n');
}

function currencyFormatter(value) {
  try {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(value);
  } catch (e) {
    return String(value);
  }
}

exports.handler = async function (event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { customer, notes = '', cart = [], totals: clientTotals } = payload;

  if (!customer || !Array.isArray(cart) || cart.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing customer or cart' }) };
  }

  const SENDGRID_KEY = process.env.SENDGRID_API_KEY;
  const SEND_TO = process.env.SENDGRID_TO;
  const SEND_FROM = process.env.SENDGRID_FROM || SEND_TO;

  if (!SENDGRID_KEY || !SEND_TO) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Missing SendGrid configuration. Set SENDGRID_API_KEY and SENDGRID_TO on Netlify.' }) };
  }

  // try to load public/products.json to get product titles/prices
  let products = [];
  try {
    const productsRaw = await fetch(`${process.env.URL || ''}/products.json`).then((r) => r.json());
    products = Array.isArray(productsRaw) ? productsRaw : [];
  } catch (e) {
    products = [];
  }

  const productsMap = products.reduce((map, p) => ({ ...map, [p.id]: p }), {});

  const orderId = `ORD-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.random().toString(36).slice(2,8).toUpperCase()}`;

  const totals = clientTotals || estimateTotals(cart, productsMap);

  const plain = buildPlainTextEmail(orderId, customer, notes, cart, totals, productsMap);

  const emailBody = {
    personalizations: [
      {
        to: [{ email: SEND_TO }],
        subject: `New order ${orderId}`
      }
    ],
    from: { email: SEND_FROM },
    content: [
      { type: 'text/plain', value: plain }
    ]
  };

  try {
    const res = await fetch(SENDGRID_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SENDGRID_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailBody)
    });

    if (!res.ok) {
      const txt = await res.text();
      return { statusCode: 502, body: JSON.stringify({ error: 'SendGrid error', details: txt }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ id: orderId })
    };
  } catch (e) {
    return { statusCode: 502, body: JSON.stringify({ error: 'Failed to send email', details: String(e) }) };
  }
};

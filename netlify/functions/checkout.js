const SENDGRID_API = "https://api.sendgrid.com/v3/mail/send";

function roundMoney(value) {
  return Number(value.toFixed(2));
}

function buildPlainTextEmail(orderId, customer, notes, items, totals) {
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
    lines.push(`- ${line.productId} x${line.quantity}`);
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

  const orderId = `ORD-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.random().toString(36).slice(2,8).toUpperCase()}`;

  const totals = clientTotals && typeof clientTotals.total === 'number'
    ? clientTotals
    : { subtotal: 0, shipping: 0, tax: 0, total: 0 };

  const plain = buildPlainTextEmail(orderId, customer, notes, cart, totals);

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

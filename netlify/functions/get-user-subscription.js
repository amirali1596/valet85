const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event, context) => {
  const user = context.clientContext.user;
  if (!user) return { statusCode: 401, body: 'Unauthorized' };

  const stripeCustomerId = await getStripeCustomerId(user);

  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      limit: 1
    });

    if (subscriptions.data.length === 0) {
      return { statusCode: 404, body: 'No subscription found' };
    }

    const sub = subscriptions.data[0];

    const invoices = await stripe.invoices.list({
      customer: stripeCustomerId,
      limit: 5
    });

    const formattedInvoices = invoices.data.map(inv => ({
      date: new Date(inv.created * 1000).toLocaleDateString(),
      amount: inv.amount_paid,
      status: inv.status,
      url: inv.hosted_invoice_url
    }));

    return {
      statusCode: 200,
      body: JSON.stringify({
        plan: sub.items.data[0].plan.nickname || 'Standard',
        status: sub.status,
        nextBillingDate: new Date(sub.current_period_end * 1000).toLocaleDateString(),
        invoices: formattedInvoices
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};

// Helper to retrieve customer ID from Netlify Identity metadata
async function getStripeCustomerId(user) {
  return user.app_metadata?.stripeCustomerId;
}

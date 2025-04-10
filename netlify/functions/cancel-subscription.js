const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const mailer = require('nodemailer');

exports.handler = async (event, context) => {
  // 1. Verify authentication
  const user = context.clientContext?.user;
  if (!user) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }

  try {
    const { reason } = JSON.parse(event.body);
    
    // 2. Get Stripe customer ID from user metadata (implement your lookup)
    const stripeCustomerId = await getStripeCustomerId(user);
    if (!stripeCustomerId) {
      throw new Error('No Stripe customer linked to this account');
    }

    // 3. Cancel subscription
    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      limit: 1,
      status: 'active'
    });

    if (subscriptions.data.length === 0) {
      throw new Error('No active subscription found');
    }

    const cancelledSub = await stripe.subscriptions.cancel(
      subscriptions.data[0].id
    );

    // 4. Send confirmation email
    const customer = await stripe.customers.retrieve(stripeCustomerId);
    const transporter = mailer.createTransport({
      service: 'Gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    await transporter.sendMail({
      to: customer.email,
      subject: 'Your Valet Waste Service Has Been Cancelled',
      html: `<p>We're sorry to see you go. Your service has been cancelled.</p>
             ${reason ? `<p>Reason: ${reason}</p>` : ''}
             <p>You can reactivate anytime by logging into your dashboard.</p>`
    });

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        cancellation_date: new Date().toISOString(),
        subscription_id: cancelledSub.id
      })
    };
  } catch (error) {
    return {
      statusCode: 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: error.message,
        type: error.type || 'subscription_error'
      })
    };
  }
};

// Implement this function based on your user metadata storage
async function getStripeCustomerId(user) {
  // Example: Query your database or Netlify Identity metadata
  // Return the Stripe customer ID linked to this user
  return 'cus_xxxxxxxxxxxxx';
}
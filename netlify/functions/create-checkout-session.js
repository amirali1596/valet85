
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  try {
    const { email, plan } = JSON.parse(event.body);

    // Create a customer in Stripe
    const customer = await stripe.customers.create({ email });

    // Create a Checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer: customer.id,
      line_items: [
        {
          price: plan, // Replace with your Stripe Price ID
          quantity: 1
        }
      ],
      success_url: `${process.env.URL}/auth/success.html`,
      cancel_url: `${process.env.URL}/auth/signup.html`
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ sessionId: session.id })
    };
  } catch (error) {
    console.error('Stripe session creation error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Unable to create checkout session' })
    };
  }
};

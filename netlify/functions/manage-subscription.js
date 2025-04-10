// netlify/functions/manage-subscription.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  const { customerId, action } = JSON.parse(event.body);
  
  try {
    // Get customer's subscription
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 1
    });

    if (subscriptions.data.length === 0) {
      throw new Error('No subscription found');
    }

    const sub = subscriptions.data[0];
    let result;

    if (action === 'cancel') {
      result = await stripe.subscriptions.cancel(sub.id);
    } else if (action === 'reactivate') {
      result = await stripe.subscriptions.update(sub.id, {
        cancel_at_period_end: false
      });
    } else {
      throw new Error('Invalid action');
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({
        success: true,
        status: result.status,
        cancel_at_period_end: result.cancel_at_period_end
      })
    };
  } catch (error) {
    return {
      statusCode: 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({
        error: error.message
      })
    };
  }
};
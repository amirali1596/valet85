// process-payment.js - Complete Working Version
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-08-16',
  timeout: 10000,
  maxNetworkRetries: 2
});

exports.handler = async (event) => {
  // 1. DEBUG: Immediate logging
  console.log('---------- FUNCTION START ----------');
  console.log('Raw event:', JSON.stringify(event, null, 2));

  // 2. Validate HTTP method 
  if (event.httpMethod !== 'POST') {
    console.error('Invalid method:', event.httpMethod);
    return {
      statusCode: 405,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache' // Prevent caching
      },
      body: JSON.stringify({ 
        error: 'Method Not Allowed',
        message: 'Only POST requests accepted'
      })
    };
  }

  // 3. Parse and validate body
  let requestData;
  try {
    requestData = JSON.parse(event.body);
    console.log('Parsed body:', JSON.stringify(requestData, null, 2));
  } catch (err) {
    console.error('Parse error:', err);
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'Invalid JSON',
        details: err.message 
      })
    };
  }

  // 4. Validate required fields (original validation + debug)
  const requiredFields = ['paymentMethodId', 'email', 'name', 'plan'];
  const missingFields = requiredFields.filter(f => !requestData[f]);
  
  if (missingFields.length > 0) {
    console.error('Missing fields:', missingFields);
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'Missing Fields',
        missing: missingFields,
        received: Object.keys(requestData)
      })
    };
  }

  // 5. ORIGINAL STRIPE LOGIC (preserved) with enhanced logging
  try {
    // Customer handling (original code)
    let customer;
    const existingCustomers = await stripe.customers.list({ 
      email: requestData.email.toLowerCase().trim(),
      limit: 1 
    });
    
    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
      console.log('Existing customer:', customer.id);
      
      await stripe.paymentMethods.attach(requestData.paymentMethodId, {
        customer: customer.id
      });
      
      await stripe.customers.update(customer.id, {
        invoice_settings: {
          default_payment_method: requestData.paymentMethodId
        }
      });
    } else {
      console.log('Creating new customer');
      customer = await stripe.customers.create({
        email: requestData.email,
        name: requestData.name,
        payment_method: requestData.paymentMethodId,
        invoice_settings: {
          default_payment_method: requestData.paymentMethodId
        }
      });
    }

    // Price selection (original)
    const priceId = requestData.plan === 'standard' 
      ? process.env.STANDARD_PRICE_ID 
      : process.env.PREMIUM_PRICE_ID;

    if (!priceId) {
      throw new Error(`Price ID missing for plan: ${requestData.plan}`);
    }

    // Subscription creation (original)
    console.log('Creating subscription with price:', priceId);
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      payment_settings: {
        payment_method_types: ['card'],
        save_default_payment_method: 'on_subscription'
      },
      expand: ['latest_invoice.payment_intent'],
      metadata: { signup_source: 'valet-waste-web' }
    });

    console.log('Subscription success:', subscription.id);

    // ORIGINAL SUCCESS RESPONSE
    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json',
        'X-Netlify-Function': 'process-payment' // Debug header
      },
      body: JSON.stringify({
        success: true,
        customerId: customer.id,
        subscriptionId: subscription.id,
        clientSecret: subscription.latest_invoice.payment_intent.client_secret
      })
    };

  } catch (error) {
    // ENHANCED ERROR HANDLING (original + debug)
    console.error('STRIPE ERROR:', {
      message: error.message,
      type: error.type,
      stack: error.stack
    });

    return {
      statusCode: error.statusCode || 400,
      headers: { 
        'Content-Type': 'application/json',
        'X-Error-Type': error.type || 'StripeError' 
      },
      body: JSON.stringify({
        error: error.message,
        type: error.type,
        code: error.code,
        requestId: error.requestId
      })
    };
  }
};
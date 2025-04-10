
const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  if (!context.clientContext.user) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  const { stripeCustomerId } = JSON.parse(event.body || '{}');
  const userId = context.clientContext.user.sub;

  try {
    const response = await fetch(`${process.env.URL}/.netlify/identity/admin/users/${userId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${process.env.NETLIFY_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_metadata: {
          stripeCustomerId,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update user metadata: ${await response.text()}`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

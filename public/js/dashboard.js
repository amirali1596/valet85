document.addEventListener('DOMContentLoaded', async () => {
  // Authentication check
  const user = netlifyIdentity.currentUser();
  if (!user) {
    window.location.href = '/auth/login.html';
    return;
  }

  // Load user data
  try {
    // Load subscription data
    const subscriptionResponse = await fetch('/.netlify/functions/get-user-subscription', {
      headers: {
        'Authorization': 'Bearer ' + user.token.access_token
      }
    });
    
    if (!subscriptionResponse.ok) throw new Error('Failed to load subscription');
    const subscriptionData = await subscriptionResponse.json();
    
    // Load user profile
    const profileResponse = await fetch('/.netlify/functions/get-profile', {
      headers: {
        'Authorization': 'Bearer ' + user.token.access_token
      }
    });
    const profileData = profileResponse.ok ? await profileResponse.json() : {};

    // Render dashboard
    renderDashboard({
      user: {
        email: user.email,
        ...profileData
      },
      subscription: subscriptionData
    });

  } catch (error) {
    console.error('Dashboard loading error:', error);
    showError(error.message);
  }

  // Logout handler
  document.getElementById('logout').addEventListener('click', () => {
    netlifyIdentity.logout();
    window.location.href = '/';
  });

  // Billing portal handler
  document.getElementById('manage-billing')?.addEventListener('click', manageBilling);
});

// Render dashboard content
function renderDashboard(data) {
  // User info section
  const userInfoElement = document.getElementById('user-info');
  if (userInfoElement) {
    userInfoElement.innerHTML = `
      <h2>Welcome, ${data.user.name || data.user.email}</h2>
      <p>Email: ${data.user.email}</p>
      ${data.user.phone ? `<p>Phone: ${data.user.phone}</p>` : ''}
    `;
  }

  // Subscription section
  const subscriptionElement = document.getElementById('subscription-info');
  if (subscriptionElement) {
    if (data.subscription.active) {
      subscriptionElement.innerHTML = `
        <div class="subscription-card">
          <h3>${data.subscription.plan} Plan</h3>
          <p>Status: <span class="status ${data.subscription.status}">${data.subscription.status}</span></p>
          <p>Next Billing Date: ${data.subscription.next_bill}</p>
          <button id="manage-billing" class="btn">Manage Billing</button>
        </div>
      `;
    } else {
      subscriptionElement.innerHTML = `
        <div class="subscription-card inactive">
          <h3>No Active Subscription</h3>
          <p>Your account doesn't have an active subscription</p>
          <a href="/signup.html" class="btn">Subscribe Now</a>
        </div>
      `;
    }
  }

  // Add event listener for newly created billing button
  document.getElementById('manage-billing')?.addEventListener('click', manageBilling);
}

// Manage billing portal
async function manageBilling() {
  try {
    const user = netlifyIdentity.currentUser();
    const response = await fetch('/.netlify/functions/create-portal-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + user.token.access_token
      }
    });
    
    if (!response.ok) throw new Error('Failed to create billing session');
    const { url } = await response.json();
    window.location.href = url;
  } catch (error) {
    console.error('Billing portal error:', error);
    showError('Could not open billing portal. Please try again.');
  }
}

// Show error message
function showError(message) {
  const errorElement = document.getElementById('error-message') || document.createElement('div');
  errorElement.id = 'error-message';
  errorElement.className = 'error-message';
  errorElement.textContent = message;
  
  if (!document.getElementById('error-message')) {
    errorElement.style.position = 'fixed';
    errorElement.style.bottom = '20px';
    errorElement.style.right = '20px';
    errorElement.style.padding = '15px';
    errorElement.style.background = '#ff4444';
    errorElement.style.color = 'white';
    errorElement.style.borderRadius = '5px';
    errorElement.style.zIndex = '1000';
    document.body.appendChild(errorElement);
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      errorElement.remove();
    }, 5000);
  }
}
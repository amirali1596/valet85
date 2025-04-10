// Initialize Netlify Identity with proper configuration
netlifyIdentity.init({
  APIUrl: 'https://your-site.netlify.app/.netlify/identity',
  logo: false,
  locale: 'en' // Set preferred language
});

// Main authentication handler
document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const signupForm = document.getElementById('signup-form');
  const loginForm = document.getElementById('login-form');
  const logoutBtn = document.getElementById('logout');
  
  // Event listeners
  if (signupForm) setupSignupForm(signupForm);
  if (loginForm) setupLoginForm(loginForm);
  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

  // Authentication state handlers
  netlifyIdentity.on('init', user => console.log('Auth initialized', user));
  netlifyIdentity.on('login', handleLogin);
  netlifyIdentity.on('logout', handleLogout);
  netlifyIdentity.on('error', err => console.error('Auth error:', err));
  
  // Auto-redirect if already logged in
  if (netlifyIdentity.currentUser()) {
    window.location.href = '/dashboard/';
  }
});

// Signup form handler
function setupSignupForm(form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Get form data
    const email = form.querySelector('#email').value.trim();
    const name = form.querySelector('#name')?.value.trim();
    const phone = form.querySelector('#phone')?.value.trim();
    
    // UI elements
    const submitBtn = form.querySelector('button[type="submit"]');
    const errorDisplay = form.querySelector('.error-message') || createErrorDisplay(form);
    
    try {
      // Show loading state
      toggleLoading(submitBtn, true);
      errorDisplay.textContent = '';
      errorDisplay.classList.add('hidden');
      
      // 1. First process payment with Stripe
      const paymentResult = await processStripePayment(form);
      if (!paymentResult.success) {
        throw new Error(paymentResult.error || 'Payment processing failed');
      }
      
      // 2. Create Netlify Identity account with generated password
      const password = generateSecurePassword();
      const user = await netlifyIdentity.signup(email, password);
      if (!user) throw new Error('Failed to create user account');
      
      // 3. Update user metadata (name, phone)
      if (name || phone) {
        await updateUserMetadata(user, { name, phone });
      }
      
      // 4. Link Stripe customer to Netlify user
      await linkStripeCustomer(user, paymentResult.customerId);
      
      // 5. Complete login and redirect
      netlifyIdentity.close();
      window.location.href = '/success.html?' + new URLSearchParams({
        plan: paymentResult.plan,
        amount: paymentResult.amount,
        customerId: paymentResult.customerId
      });
      
    } catch (error) {
      console.error('Signup error:', error);
      errorDisplay.textContent = error.message;
      errorDisplay.classList.remove('hidden');
    } finally {
      toggleLoading(submitBtn, false);
    }
  });
}

// Login form handler
function setupLoginForm(form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = form.querySelector('#email').value.trim();
    const password = form.querySelector('#password').value;
    const submitBtn = form.querySelector('button[type="submit"]');
    const errorDisplay = form.querySelector('.error-message');
    
    try {
      toggleLoading(submitBtn, true);
      errorDisplay.textContent = '';
      errorDisplay.classList.add('hidden');
      
      const user = await netlifyIdentity.login(email, password);
      if (!user) throw new Error('Login failed - please check your credentials');
      
      // Login handler will redirect
    } catch (error) {
      errorDisplay.textContent = error.message;
      errorDisplay.classList.remove('hidden');
    } finally {
      toggleLoading(submitBtn, false);
    }
  });
}

// Handle successful login
function handleLogin(user) {
  console.log('User logged in:', user);
  netlifyIdentity.close();
  
  // Store user data in localStorage if needed
  localStorage.setItem('netlifyUser', JSON.stringify({
    email: user.email,
    id: user.id,
    token: user.token.access_token
  }));
  
  window.location.href = '/dashboard/';
}

// Handle logout
function handleLogout() {
  netlifyIdentity.logout();
  localStorage.removeItem('netlifyUser');
  window.location.href = '/';
}

// Process Stripe payment (simplified example)
async function processStripePayment(form) {
  // This would be replaced with your actual Stripe Elements implementation
  const stripe = Stripe(process.env.STRIPE_PUBLIC_KEY);
  const elements = stripe.elements();
  
  // Create card element
  const cardElement = elements.create('card');
  cardElement.mount('#card-element');
  
  // Get other form data
  const formData = new FormData(form);
  const { plan } = Object.fromEntries(formData);
  
  try {
    // Create payment method
    const { paymentMethod, error } = await stripe.createPaymentMethod({
      type: 'card',
      card: cardElement,
      billing_details: {
        name: formData.get('name'),
        email: formData.get('email'),
        phone: formData.get('phone')
      }
    });
    
    if (error) throw error;
    
    // Process payment via Netlify function
    const response = await fetch('/.netlify/functions/process-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentMethodId: paymentMethod.id,
        email: formData.get('email'),
        name: formData.get('name'),
        plan
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Payment failed');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Payment error:', error);
    return { success: false, error: error.message };
  }
}

// Link Stripe customer to Netlify user
async function linkStripeCustomer(user, stripeCustomerId) {
  try {
    const response = await fetch('/.netlify/functions/link-customer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + user.token.access_token
      },
      body: JSON.stringify({ stripeCustomerId })
    });
    
    if (!response.ok) {
      throw new Error('Failed to link customer account');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Customer linking error:', error);
    throw error;
  }
}

// Update user metadata (name, phone, etc.)
async function updateUserMetadata(user, metadata) {
  try {
    const response = await fetch('/.netlify/functions/update-profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + user.token.access_token
      },
      body: JSON.stringify(metadata)
    });
    
    if (!response.ok) {
      throw new Error('Failed to update user profile');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Profile update error:', error);
    throw error;
  }
}

// Helper functions
function generateSecurePassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
  let password = '';
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

function toggleLoading(button, isLoading) {
  if (isLoading) {
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
  } else {
    button.disabled = false;
    button.innerHTML = button.dataset.originalText || 'Continue';
  }
}

function createErrorDisplay(form) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message hidden';
  form.insertBefore(errorDiv, form.firstChild);
  return errorDiv;
}
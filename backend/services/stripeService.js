const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const stripeService = {
  // Create a new Stripe Customer
  createCustomer: async (email, name) => {
    try {
      const customer = await stripe.customers.create({
        email,
        name,
      });
      return customer;
    } catch (error) {
      console.error('Error creating Stripe customer:', error);
      throw error;
    }
  },

  // Create a Checkout Session for subscription
  createCheckoutSession: async (customerId, priceId) => {
    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_collection: 'always',
        customer: customerId,
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        subscription_data: {
            trial_period_days: 7,
        },
        allow_promotion_codes: true,
        success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/subscription-plans`,
      });
      return session;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw error;
    }
  },

  // Create a Customer Portal Session for managing subscription
  createPortalSession: async (customerId) => {
    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard`,
      });
      return session;
    } catch (error) {
      console.error('Error creating portal session:', error);
      throw error;
    }
  },

  // Construct webhook event securely
  constructEvent: (payload, signature) => {
    try {
      return stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (error) {
      console.error('Webhook signature verification failed:', error.message);
      throw error;
    }
  }
};

module.exports = stripeService;

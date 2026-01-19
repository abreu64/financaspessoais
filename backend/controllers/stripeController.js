const stripeService = require('../services/stripeService');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase Client (Consider moving to a shared config file later)
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const stripeController = {
    // Config: Endpoint to create a checkout session
    createCheckoutSession: async (req, res) => {
        try {
            const { priceId } = req.body;
            // Get the user from the authenticated request
            // Note: req.user should be populated by the auth middleware
            const userId = req.user.id;

            // Fetch user's stripe_customer_id from DB
            const { data: user, error } = await supabase
                .from('usuarios')
                .select('stripe_customer_id')
                .eq('id', userId)
                .single();

            if (error || !user) {
                return res.status(404).json({ error: 'User not found' });
            }

            if (!user.stripe_customer_id) {
                return res.status(400).json({ error: 'Stripe customer ID not found for user' });
            }

            const session = await stripeService.createCheckoutSession(
                user.stripe_customer_id,
                priceId || process.env.STRIPE_PRICE_ID
            );

            res.json({ url: session.url });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // Config: Endpoint to create a portal session
    createPortalSession: async (req, res) => {
        try {
            const userId = req.user.id;

            // Fetch user's stripe_customer_id
            const { data: user, error } = await supabase
                .from('usuarios')
                .select('stripe_customer_id')
                .eq('id', userId)
                .single();

            if (error || !user?.stripe_customer_id) {
                return res.status(400).json({ error: 'Stripe customer ID not found' });
            }

            const session = await stripeService.createPortalSession(user.stripe_customer_id);
            res.json({ url: session.url });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // Webhook handler
    webhook: async (req, res) => {
        const signature = req.headers['stripe-signature'];

        let event;
        try {
            event = stripeService.constructEvent(req.body, signature);
        } catch (err) {
            console.log(`⚠️  Webhook signature verification failed.`, err.message);
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }

        // Handle the event
        try {
            switch (event.type) {
                case 'checkout.session.completed':
                    const session = event.data.object;
                    // Update user subscription status
                    // Find user by stripe_customer_id
                    console.log('✅ Checkout session completed for customer:', session.customer);
                    await updateUserSubscription(session.customer, 'active', session.subscription);
                    break;

                case 'invoice.payment_failed':
                    const invoice = event.data.object;
                    console.log('❌ Invoice payment failed for customer:', invoice.customer);
                    await updateUserSubscription(invoice.customer, 'past_due', invoice.subscription);
                    break;

                case 'customer.subscription.deleted':
                    const subscription = event.data.object;
                    console.log('🗑️ Subscription deleted/canceled for customer:', subscription.customer);
                    await updateUserSubscription(subscription.customer, 'canceled', subscription.id);
                    break;

                case 'customer.subscription.updated':
                    const subUpdated = event.data.object;
                    console.log('📝 Subscription updated for customer:', subUpdated.customer);
                    await updateUserSubscription(subUpdated.customer, subUpdated.status, subUpdated.id);
                    break;

                default:
                    console.log(`Unhandled event type ${event.type}`);
            }
        } catch (error) {
            console.error('Error handling webhook event:', error);
            return res.status(500).send('Webhook handler error');
        }

        // Return a 200 response to acknowledge receipt of the event
        res.send();
    }
};

// Helper function to update user subscription in DB
async function updateUserSubscription(stripeCustomerId, status, subscriptionId) {
    const { error } = await supabase
        .from('usuarios')
        .update({
            subscription_status: status,
            subscription_id: subscriptionId,
            updated_at: new Date().toISOString()
        })
        .eq('stripe_customer_id', stripeCustomerId);

    if (error) {
        console.error('Error updating user subscription in DB:', error);
        throw error;
    }
    console.log(`User subscription updated: ${status}`);
}

module.exports = stripeController;

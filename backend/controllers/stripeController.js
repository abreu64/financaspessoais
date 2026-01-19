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
            console.log('🔍 Criando Checkout Session para UserId:', userId);

            // Fetch user's stripe_customer_id from DB
            const { data: user, error } = await supabase
                .from('usuarios')
                .select('stripe_customer_id, email, nome')
                .eq('id', userId)
                .single();

            let stripe_customer_id = user?.stripe_customer_id;

            // Se o usuário não existe no DB ou não tem Stripe ID, vamos criar agora (Auto-healing)
            if (error || !user || !stripe_customer_id) {
                console.log('🔄 Usuário incompleto no DB. Tentando criar/vincular Stripe...');

                const email = req.user.email;
                const nome = req.user.user_metadata?.nome || req.user.email.split('@')[0];

                try {
                    // 1. Criar no Stripe se necessário
                    console.log('💳 Criando cliente no Stripe para:', email);
                    const customer = await stripeService.createCustomer(email, nome);
                    stripe_customer_id = customer.id;

                    // 2. Salvar ou atualizar no DB
                    console.log('💾 Salvando usuário no Banco...');
                    const { error: upsertError } = await supabase
                        .from('usuarios')
                        .upsert({
                            id: userId,
                            email: email,
                            nome: nome,
                            stripe_customer_id: stripe_customer_id,
                            subscription_status: user?.subscription_status || 'trialing',
                            updated_at: new Date().toISOString()
                        });

                    if (upsertError) throw upsertError;
                    console.log('✅ Usuário sincronizado com sucesso!');
                } catch (syncError) {
                    console.error('❌ Falha na sincronização do usuário:', syncError.message);
                    return res.status(500).json({ error: 'Erro ao configurar perfil de pagamento: ' + syncError.message });
                }
            }

            // Prosseguir com a criação da sessão usando o ID (novo ou antigo)
            const session = await stripeService.createCheckoutSession(
                stripe_customer_id,
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
            let { data: user, error } = await supabase
                .from('usuarios')
                .select('stripe_customer_id')
                .eq('id', userId)
                .single();

            let stripe_customer_id = user?.stripe_customer_id;

            // Auto-healing: Se não tem stripe_customer_id, vamos criar/sincronizar
            if (error || !user || !stripe_customer_id) {
                console.log('🔄 Sincronizando usuário para o Portal...');
                const email = req.user.email;
                const nome = req.user.user_metadata?.nome || email.split('@')[0];

                try {
                    const customer = await stripeService.createCustomer(email, nome);
                    stripe_customer_id = customer.id;

                    await supabase.from('usuarios').upsert({
                        id: userId,
                        email: email,
                        nome: nome,
                        stripe_customer_id: stripe_customer_id,
                        updated_at: new Date().toISOString()
                    });
                } catch (syncError) {
                    console.error('❌ Erro na sincronização para o Portal:', syncError.message);
                    return res.status(500).json({ error: 'Erro ao configurar perfil de pagamento: ' + syncError.message });
                }
            }

            const session = await stripeService.createPortalSession(stripe_customer_id);
            res.json({ url: session.url });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // Get current subscription status and price info
    getSubscriptionStatus: async (req, res) => {
        try {
            const userId = req.user.id;

            // 1. Buscar dados do usuário no DB
            const { data: user, error } = await supabase
                .from('usuarios')
                .select('subscription_status, subscription_id, stripe_customer_id, created_at')
                .eq('id', userId)
                .single();

            if (error || !user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // 2. Buscar info do preço no Stripe
            const priceInfo = await stripeService.getPriceInfo(process.env.STRIPE_PRICE_ID);

            // 3. Se tiver assinatura, buscar detalhes (para ver trial_end)
            let trialEnd = null;
            if (user.subscription_id) {
                try {
                    const subscription = await stripeService.getSubscription(user.subscription_id);
                    trialEnd = subscription.trial_end;
                } catch (subError) {
                    console.log('⚠️ Erro ao buscar detalhes da assinatura no Stripe:', subError.message);
                }
            }

            // 4. Calcular Trial Local (7 dias após criação) caso não tenha trial no Stripe
            const createdAt = new Date(user.created_at);
            const localTrialEnd = Math.floor(createdAt.getTime() / 1000) + (7 * 24 * 60 * 60);

            res.json({
                status: user.subscription_status,
                price: priceInfo,
                trial_end: trialEnd || localTrialEnd, // Prioriza Stripe, senão usa DB
                created_at: user.created_at,
                server_time: Math.floor(Date.now() / 1000)
            });
        } catch (error) {
            console.error('Error in getSubscriptionStatus:', error);
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

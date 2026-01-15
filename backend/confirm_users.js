const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://xqcwlxyflniaptjqwdwr.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'REVOGADA_CHAVE_SUPABASE';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function confirmUsers() {
    console.log('🔍 Buscando usuários...');

    const { data: { users }, error } = await supabase.auth.admin.listUsers();

    if (error) {
        console.error('❌ Erro ao listar usuários:', error.message);
        return;
    }

    console.log(`✅ Encontrados ${users.length} usuários.`);

    for (const user of users) {
        if (!user.email_confirmed_at) {
            console.log(`⏳ Confirmando e-mail para: ${user.email}...`);

            const { data, error: updateError } = await supabase.auth.admin.updateUserById(
                user.id,
                { email_confirm: true }
            );

            if (updateError) {
                console.error(`❌ Erro ao confirmar ${user.email}:`, updateError.message);
            } else {
                console.log(`✅ Usuário ${user.email} confirmado com sucesso!`);
            }
        } else {
            console.log(`ℹ️ Usuário ${user.email} já está confirmado.`);
        }
    }
}

confirmUsers();

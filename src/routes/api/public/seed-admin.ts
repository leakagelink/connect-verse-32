import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/public/seed-admin')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = request.headers.get('x-seed-key')
        if (key !== 'one-time-talkora-seed-2026') {
          return new Response('Forbidden', { status: 403 })
        }
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        const email = 'hello@socilet.in'
        const password = 'Pyariiccha@123'

        // Find or create user
        let userId: string | null = null
        const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 })
        const existing = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
        if (existing) {
          userId = existing.id
          await supabaseAdmin.auth.admin.updateUserById(userId, { password, email_confirm: true })
        } else {
          const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
          })
          if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })
          userId = created.user!.id
        }

        // Grant admin role
        await supabaseAdmin.from('user_roles').insert({ user_id: userId, role: 'admin' }).select()
        return new Response(JSON.stringify({ ok: true, userId }), {
          headers: { 'content-type': 'application/json' },
        })
      },
    },
  },
})

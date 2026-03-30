'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Props = {
  onSuccess?: () => void
}

export default function AuthForm({ onSuccess }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
      } else {
        // Informa ao usuário sobre o recebimento do email de confirmação
        alert('Verifique seu email para confirmar a conta. Em seguida, faça login.')
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
      } else {
        // Sessão já é persistida pelo Supabase; redireciona
        onSuccess?.()
        router.push('/feed')
      }
    }

    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 bg-black/70 rounded-md shadow-md w-full max-w-md mx-auto">
      <h2 className="text-xl font-semibold mb-4">{isSignUp ? 'Cadastre-se' : 'Entrar'}</h2>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        className="w-full p-2 mb-3 bg-white/5 border rounded"
        required
      />
      <input
        type="password"
        placeholder="Senha"
        value={password}
        onChange={e => setPassword(e.target.value)}
        className="w-full p-2 mb-3 bg-white/5 border rounded"
        required
      />
      {error && <div className="text-red-400 mb-2">{error}</div>}
      <button type="submit" className="w-full py-2 rounded bg-sky-600 hover:bg-sky-700" disabled={loading}>
        {loading ? 'Aguarde...' : isSignUp ? 'Cadastrar' : 'Entrar'}
      </button>
      <div className="mt-3 text-sm text-gray-200">
        {isSignUp ? 'Já tem uma conta?' : 'Não tem uma conta?'}{' '}
        <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="text-blue-300">
          {isSignUp ? 'Entrar' : 'Cadastre-se'}
        </button>
      </div>
      <p className="text-xs text-gray-400 mt-2">
        Observação: a confirmação de email é enviada automaticamente pelo Supabase.
      </p>
    </form>
  )
}

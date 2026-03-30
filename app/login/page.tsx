'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.push('/')
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
        if (signUpError) throw signUpError
        
        if (data.user) {
          const { error: dbError } = await supabase
            .from('usuarios')
            .upsert({ 
              id: data.user.id, 
              username: username.toLowerCase().trim().replace(/\s+/g, '_'), 
              full_name: username 
            })
          if (dbError) throw dbError
          alert("Cadastro concluído! Agora entre com seu e-mail.")
          setIsLogin(true)
        }
      }
    } catch (err: any) {
      alert("Erro: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4 font-sans">
      <div className="max-w-[360px] w-full">
        <div className="flex justify-center mb-10">
          <svg viewBox="0 0 24 24" className="h-10 w-10 fill-white"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path></svg>
        </div>
        <h1 className="text-3xl font-bold mb-8">{isLogin ? 'Entrar no X' : 'Criar sua conta'}</h1>
        <form onSubmit={handleAuth} className="space-y-4">
          {!isLogin && (
            <input type="text" placeholder="Nome de usuário (@exemplo)" className="w-full p-4 bg-black border border-gray-800 rounded focus:border-sky-500 outline-none transition-all" value={username} onChange={(e) => setUsername(e.target.value)} required />
          )}
          <input type="email" placeholder="E-mail" className="w-full p-4 bg-black border border-gray-800 rounded focus:border-sky-500 outline-none transition-all" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="Senha" className="w-full p-4 bg-black border border-gray-800 rounded focus:border-sky-500 outline-none transition-all" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button type="submit" disabled={loading} className="w-full bg-white text-black font-bold py-3 rounded-full hover:bg-gray-200 transition-all text-lg mt-2 disabled:opacity-50">
            {loading ? 'Processando...' : (isLogin ? 'Entrar' : 'Registrar')}
          </button>
        </form>
        <button onClick={() => setIsLogin(!isLogin)} className="w-full mt-8 text-sky-500 hover:underline text-center text-[15px]">
          {isLogin ? 'Não tem uma conta? Inscreva-se' : 'Já tem uma conta? Entrar'}
        </button>
      </div>
    </div>
  )
}
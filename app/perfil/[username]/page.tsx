'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Calendar, Camera, X, Heart, MessageCircle, Send, Bell, Search } from 'lucide-react'

export default function PerfilUsuario() {
  const { username } = useParams()
  const router = useRouter()
  
  const [perfil, setPerfil] = useState<any>(null)
  const [meuId, setMeuId] = useState<string | null>(null)
  const [meusDados, setMeusDados] = useState<any>(null)
  const [editando, setEditando] = useState(false)
  const [loading, setLoading] = useState(true)
  const [subindoImagem, setSubindoImagem] = useState(false)
  
  const [postsUsuario, setPostsUsuario] = useState<any[]>([])
  const [listaSeguidores, setListaSeguidores] = useState<any[]>([])
  const [listaSeguindo, setListaSeguindo] = useState<any[]>([])
  const [showSeguidores, setShowSeguidores] = useState(false)
  const [showSeguindo, setShowSeguindo] = useState(false)
  const [jaSigo, setJaSigo] = useState(false)
  const [form, setForm] = useState({ full_name: '', bio: '', avatar_url: '', banner_url: '' })

  const [showComentarios, setShowComentarios] = useState(false)
  const [postSelecionado, setPostSelecionado] = useState<any>(null)
  const [comentarios, setComentarios] = useState<any[]>([])
  const [novoComentario, setNovoComentario] = useState('')

  const [notificacoes, setNotificacoes] = useState<any[]>([])
  const [showNotificacoes, setShowNotificacoes] = useState(false)

  // Estados para Pesquisa
  const [busca, setBusca] = useState('')
  const [resultadosBusca, setResultadosBusca] = useState<any[]>([])

  const avatarInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)

  const formatarData = (dataStr: string) => {
    if (!dataStr) return ''
    const data = new Date(dataStr)
    return data.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
  }

  useEffect(() => { fetchDadosCompletos() }, [username])

  // Lógica de busca de usuários
  useEffect(() => {
    const buscarUsuarios = async () => {
      if (busca.length < 2) {
        setResultadosBusca([])
        return
      }
      const { data } = await supabase
        .from('usuarios')
        .select('id, username, full_name, avatar_url')
        .ilike('username', `%${busca}%`)
        .limit(5)
      setResultadosBusca(data || [])
    }
    const timer = setTimeout(buscarUsuarios, 300)
    return () => clearTimeout(timer)
  }, [busca])

  async function fetchDadosCompletos() {
    setLoading(true)
    const { data: { user: sessionUser } } = await supabase.auth.getUser()
    
    if (sessionUser) {
      setMeuId(sessionUser.id)
      const { data: meuPerfil } = await supabase
        .from('usuarios')
        .select('id, username, full_name, avatar_url')
        .eq('id', sessionUser.id)
        .single()
      setMeusDados(meuPerfil)

      const { data: notifs } = await supabase
        .from('notificações')
        .select('*, autor:autor_id(username, avatar_url)')
        .eq('usuario_id', sessionUser.id)
        .order('created_at', { ascending: false })
      setNotificacoes(notifs || [])
    }

    const { data: userProfile, error } = await supabase.from('usuarios').select('*').eq('username', username).single()

    if (!error && userProfile) {
      setPerfil(userProfile)
      setForm({ 
        full_name: userProfile.full_name || '', 
        bio: userProfile.bio || '',
        avatar_url: userProfile.avatar_url || '',
        banner_url: userProfile.banner_url || ''
      })

      // Posts
      const { data: posts } = await supabase
        .from('posts')
        .select('*, usuarios(username, full_name, avatar_url), curtidas(usuario_id)')
        .eq('usuario_id', userProfile.id)
        .order('created_at', { ascending: false })
      setPostsUsuario(posts || [])

      // BUSCAR SEGUIDORES
      const { data: followers } = await supabase
        .from('seguidores')
        .select('seguidor_id, usuarios:seguidor_id (id, username, full_name, avatar_url)')
        .eq('seguido_id', userProfile.id)
      setListaSeguidores(followers || [])

      // BUSCAR SEGUINDO (Corrigido Join)
      const { data: following } = await supabase
        .from('seguidores')
        .select('seguido_id, usuarios:seguido_id (id, username, full_name, avatar_url)')
        .eq('seguidor_id', userProfile.id)
      setListaSeguindo(following || [])

      if (sessionUser) {
        setJaSigo(followers?.some((f: any) => f.seguidor_id === sessionUser.id) || false)
      }
    }
    setLoading(false)
  }

  async function marcarNotificacoesLidas() {
    if (!meuId || !notificacoes.some(n => !n.lida)) return
    // Corrigido para o nome exato da sua tabela: notificações
    await supabase.from('notificações').update({ lida: true }).eq('usuario_id', meuId).eq('lida', false)
    setNotificacoes(prev => prev.map(n => ({ ...n, lida: true })))
  }

  // ... (Outras funções toggleLike, toggleFollow, enviarComentario, etc permanecem iguais)
  async function criarNotificacao(destinatarioId: string, tipo: 'curtida' | 'comentario' | 'seguidor', postId?: number) {
    if (!meuId || destinatarioId === meuId) return 
    await supabase.from('notificações').insert({
      usuario_id: destinatarioId,
      autor_id: meuId,
      tipo: tipo,
      post_id: postId
    })
  }

  async function toggleLike(postId: number, jaCurti: boolean, donoDoPostId: string) {
    if (!meuId) return
    setPostsUsuario(prev => prev.map(post => {
      if (post.id === postId) {
        const novasCurtidas = jaCurti 
          ? post.curtidas.filter((c: any) => c.usuario_id !== meuId)
          : [...post.curtidas, { usuario_id: meuId }]
        return { ...post, curtidas: novasCurtidas }
      }
      return post
    }))
    if (jaCurti) {
      await supabase.from('curtidas').delete().eq('post_id', postId).eq('usuario_id', meuId)
    } else {
      await supabase.from('curtidas').insert({ post_id: postId, usuario_id: meuId })
      await criarNotificacao(donoDoPostId, 'curtida', postId)
    }
  }

  async function toggleFollow() {
    if (!meuId || !perfil || !meusDados || meuId === perfil.id) return
    const estavaSeguindo = jaSigo
    setJaSigo(!jaSigo)
    if (estavaSeguindo) {
      setListaSeguidores(prev => prev.filter(f => f.seguidor_id !== meuId))
      await supabase.from('seguidores').delete().eq('seguidor_id', meuId).eq('seguido_id', perfil.id)
    } else {
      setListaSeguidores(prev => [...prev, { seguidor_id: meuId, usuarios: { ...meusDados } }])
      const { error } = await supabase.from('seguidores').insert({ seguidor_id: meuId, seguido_id: perfil.id })
      if (!error) { await criarNotificacao(perfil.id, 'seguidor') }
    }
  }

  async function abrirComentarios(post: any) {
    setPostSelecionado(post)
    setShowComentarios(true)
    const { data } = await supabase
      .from('comentarios')
      .select('*, usuarios:usuario_id(username, full_name, avatar_url)')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true })
    setComentarios(data || [])
  }

  async function enviarComentario() {
    if (!novoComentario.trim() || !meuId || !postSelecionado) return
    const { error } = await supabase.from('comentarios').insert({
      post_id: postSelecionado.id,
      usuario_id: meuId,
      conteudo: novoComentario
    })
    if (!error) {
      await criarNotificacao(postSelecionado.usuario_id, 'comentario', postSelecionado.id)
      setNovoComentario('')
      const { data } = await supabase
        .from('comentarios')
        .select('*, usuarios:usuario_id(username, full_name, avatar_url)')
        .eq('post_id', postSelecionado.id)
        .order('created_at', { ascending: true })
      setComentarios(data || [])
    }
  }

  async function uploadImagem(e: any, tipo: 'avatars' | 'banners') {
    const file = e.target.files?.[0]
    if (!file || !meuId) return
    setSubindoImagem(true)
    const fileName = `${meuId}-${Date.now()}.${file.name.split('.').pop()}`
    const { error: uploadError } = await supabase.storage.from(tipo).upload(fileName, file)
    if (!uploadError) {
      const { data: { publicUrl } } = supabase.storage.from(tipo).getPublicUrl(fileName)
      setForm(prev => ({ ...prev, [tipo === 'avatars' ? 'avatar_url' : 'banner_url']: publicUrl }))
    }
    setSubindoImagem(false)
  }

  async function salvarEdicao() {
    if (!meuId) return
    const { error } = await supabase.from('usuarios').update(form).eq('id', meuId)
    if (!error) { setPerfil((prev: any) => ({ ...prev, ...form })); setEditando(false) }
  }

  if (loading) return <div className="bg-black min-h-screen text-white flex items-center justify-center italic text-4xl font-bold animate-pulse">X</div>

  const naoLidas = notificacoes.filter(n => !n.lida).length

  return (
    <div className="min-h-screen bg-black text-white max-w-[600px] mx-auto border-x border-gray-800 relative">
      
      {/* HEADER COM PESQUISA */}
      <div className="p-2 flex items-center gap-3 sticky top-0 bg-black/80 backdrop-blur-md z-30 border-b border-gray-800">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-900 rounded-full transition"><ArrowLeft size={20} /></button>
        
        {/* BARRA DE PESQUISA */}
        <div className="flex-1 relative">
          <div className="flex items-center gap-2 bg-zinc-900 px-3 py-1.5 rounded-full border border-transparent focus-within:border-sky-500 transition group">
            <Search size={18} className="text-gray-500 group-focus-within:text-sky-500" />
            <input 
              placeholder="Buscar usuários..." 
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="bg-transparent outline-none text-sm w-full"
            />
            {busca && <X size={16} className="cursor-pointer text-gray-500" onClick={() => setBusca('')} />}
          </div>

          {/* RESULTADOS DA PESQUISA */}
          {resultadosBusca.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-black border border-gray-800 rounded-xl shadow-2xl overflow-hidden z-50">
              {resultadosBusca.map(u => (
                <div 
                  key={u.id} 
                  onClick={() => { router.push(`/perfil/${u.username}`); setBusca(''); }}
                  className="flex items-center gap-3 p-3 hover:bg-zinc-900 cursor-pointer transition border-b border-gray-900 last:border-0"
                >
                  <div className="w-8 h-8 rounded-full bg-zinc-800 overflow-hidden">
                    {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs">{u.username[0]}</div>}
                  </div>
                  <div>
                    <p className="text-sm font-bold leading-none">{u.full_name}</p>
                    <p className="text-xs text-gray-500">@{u.username}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <button onClick={() => { setShowNotificacoes(true); marcarNotificacoesLidas(); }} className="relative p-2 hover:bg-gray-900 rounded-full transition group">
          <Bell size={22} className="group-hover:text-sky-500 transition" />
          {naoLidas > 0 && <span className="absolute top-1 right-1 bg-red-600 w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold border-2 border-black">{naoLidas}</span>}
        </button>
      </div>

      {/* RESTO DO PERFIL (Banner, Info, Posts...) - MANTIDO IGUAL MAS COM CORREÇÃO DE VARIAVEIS SE NECESSARIO */}
      <div className="h-48 bg-zinc-900 w-full relative">
        {perfil?.banner_url && <img src={perfil.banner_url} className="w-full h-full object-cover" alt="Banner" />}
        <div className="absolute -bottom-16 left-4">
          <div className="w-32 h-32 bg-sky-600 rounded-full border-4 border-black flex items-center justify-center text-5xl font-bold uppercase overflow-hidden shadow-xl">
            {perfil?.avatar_url ? <img src={perfil.avatar_url} className="w-full h-full object-cover" alt="Avatar" /> : <span>{perfil?.username?.[0]}</span>}
          </div>
        </div>
      </div>

      <div className="flex justify-end p-4 h-20">
        {meuId === perfil?.id ? (
          <button onClick={() => setEditando(true)} className="border border-gray-600 px-4 py-1.5 rounded-full font-bold hover:bg-gray-900 transition h-fit">Editar perfil</button>
        ) : (
          <button onClick={toggleFollow} className={`${jaSigo ? 'border border-gray-600 text-white hover:bg-red-500/10 hover:border-red-500 hover:text-red-500 group' : 'bg-white text-black'} px-5 py-1.5 rounded-full font-bold transition h-fit w-[120px]`}>
            {jaSigo ? <><span className="group-hover:hidden">Seguindo</span><span className="hidden group-hover:inline">Deixar de seguir</span></> : 'Seguir'}
          </button>
        )}
      </div>

      <div className="px-4 space-y-3">
        <div>
          <h2 className="text-xl font-extrabold">{perfil?.full_name}</h2>
          <p className="text-gray-500">@{perfil?.username}</p>
        </div>
        <p className="text-[15px] whitespace-pre-wrap">{perfil?.bio || "Sem bio."}</p>
        <div className="flex items-center gap-1 text-gray-500 text-sm"><Calendar size={16} /><span>Entrou em {new Date(perfil?.created_at).toLocaleDateString('pt-BR')}</span></div>
        
        <div className="flex gap-4 pb-4 border-b border-gray-800 text-sm">
          <div onClick={() => setShowSeguindo(true)} className="hover:underline cursor-pointer flex gap-1">
            <span className="font-bold text-white">{listaSeguindo.length}</span> <span className="text-gray-500">Seguindo</span>
          </div>
          <div onClick={() => setShowSeguidores(true)} className="hover:underline cursor-pointer flex gap-1">
            <span className="font-bold text-white">{listaSeguidores.length}</span> <span className="text-gray-500">Seguidores</span>
          </div>
        </div>
      </div>

      <div className="pb-20">
        {postsUsuario.map((post) => {
          const jaCurti = post.curtidas?.some((c: any) => c.usuario_id === meuId)
          return (
            <div key={post.id} className="p-4 border-b border-gray-800 flex gap-3 hover:bg-white/[0.02] transition cursor-pointer" onClick={() => abrirComentarios(post)}>
              <div className="w-10 h-10 rounded-full bg-zinc-800 flex-shrink-0 flex items-center justify-center overflow-hidden border border-gray-700">
                {perfil?.avatar_url ? <img src={perfil.avatar_url} className="w-full h-full object-cover" /> : <span className="font-bold text-sky-500 uppercase">{perfil?.username?.[0]}</span>}
              </div>
              <div className="flex flex-col w-full">
                <div className="flex gap-1 items-center">
                  <span className="font-bold text-sm">{perfil?.full_name}</span>
                  <span className="text-gray-500 text-xs">@{perfil?.username} · {formatarData(post.created_at)}</span>
                </div>
                <p className="text-[15px] mt-1">{post.conteudo}</p>
                <div className="flex items-center gap-6 mt-3">
                  <button onClick={(e) => { e.stopPropagation(); toggleLike(post.id, jaCurti, post.usuario_id); }} className={`flex items-center gap-2 text-xs transition ${jaCurti ? 'text-pink-600' : 'text-gray-500 hover:text-pink-600'}`}>
                    <Heart size={18} fill={jaCurti ? 'currentColor' : 'none'} /> {post.curtidas?.length || 0}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); abrirComentarios(post); }} className="flex items-center gap-2 text-xs text-gray-500 hover:text-sky-500 transition">
                    <MessageCircle size={18} /> <span>Respostas</span>
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* MODAL SEGUINDO */}
      {showSeguindo && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] px-4">
          <div className="bg-black w-full max-w-[400px] rounded-2xl border border-gray-800 max-h-[500px] flex flex-col shadow-2xl">
            <div className="p-4 border-b border-gray-800 flex justify-between items-center">
              <h3 className="font-bold">Seguindo</h3>
              <button onClick={() => setShowSeguindo(false)} className="p-1 hover:bg-gray-800 rounded-full transition"><X size={20}/></button>
            </div>
            <div className="overflow-y-auto p-2">
              {listaSeguindo.length === 0 ? <p className="text-gray-500 text-center py-10">Não segue ninguém ainda.</p> : 
                listaSeguindo.map((f: any) => (
                  <div key={f.seguido_id} className="flex items-center justify-between p-3 hover:bg-zinc-900 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden">
                        {f.usuarios?.avatar_url ? <img src={f.usuarios.avatar_url} className="w-full h-full object-cover" /> : <span className="text-xs uppercase">{f.usuarios?.username?.[0] || '?'}</span>}
                      </div>
                      <div>
                        <p className="font-bold text-sm">{f.usuarios?.full_name || 'Usuário'}</p>
                        <p className="text-gray-500 text-xs">@{f.usuarios?.username || 'desconhecido'}</p>
                      </div>
                    </div>
                    <button onClick={() => { setShowSeguindo(false); router.push(`/perfil/${f.usuarios?.username}`) }} className="bg-white text-black px-4 py-1 rounded-full text-xs font-bold">Ver</button>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {/* MODAL SEGUIDORES */}
      {showSeguidores && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] px-4">
          <div className="bg-black w-full max-w-[400px] rounded-2xl border border-gray-800 max-h-[500px] flex flex-col shadow-2xl">
            <div className="p-4 border-b border-gray-800 flex justify-between items-center">
              <h3 className="font-bold">Seguidores</h3>
              <button onClick={() => setShowSeguidores(false)} className="p-1 hover:bg-gray-800 rounded-full transition"><X size={20}/></button>
            </div>
            <div className="overflow-y-auto p-2">
              {listaSeguidores.length === 0 ? <p className="text-gray-500 text-center py-10">Ninguém aqui ainda.</p> : 
                listaSeguidores.map((f: any) => (
                  <div key={f.seguidor_id} className="flex items-center justify-between p-3 hover:bg-zinc-900 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden">
                        {f.usuarios?.avatar_url ? <img src={f.usuarios.avatar_url} className="w-full h-full object-cover" /> : <span className="text-xs uppercase">{f.usuarios?.username?.[0] || '?'}</span>}
                      </div>
                      <div>
                        <p className="font-bold text-sm">{f.usuarios?.full_name || 'Usuário'}</p>
                        <p className="text-gray-500 text-xs">@{f.usuarios?.username || 'desconhecido'}</p>
                      </div>
                    </div>
                    <button onClick={() => { setShowSeguidores(false); router.push(`/perfil/${f.usuarios?.username}`) }} className="bg-white text-black px-4 py-1 rounded-full text-xs font-bold">Ver</button>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOTIFICAÇÕES */}
      {showNotificacoes && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] px-4">
          <div className="bg-black w-full max-w-[450px] rounded-2xl border border-gray-800 max-h-[70vh] flex flex-col shadow-2xl">
            <div className="p-4 border-b border-gray-800 flex justify-between items-center">
              <h3 className="font-bold text-xl">Notificações</h3>
              <button onClick={() => setShowNotificacoes(false)} className="p-1 hover:bg-gray-800 rounded-full"><X size={20}/></button>
            </div>
            <div className="overflow-y-auto flex-1">
              {notificacoes.length === 0 ? (
                <p className="text-gray-500 text-center py-10">Nada por aqui ainda.</p>
              ) : (
                notificacoes.map((n) => (
                  <div key={n.id} className={`flex items-start gap-3 p-4 border-b border-gray-900 transition ${!n.lida ? 'bg-sky-500/10' : ''}`}>
                    <div className="w-10 h-10 rounded-full bg-zinc-800 overflow-hidden flex-shrink-0">
                      {n.autor?.avatar_url ? <img src={n.autor.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center uppercase">{n.autor?.username[0]}</div>}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm">
                        <span className="font-bold text-white">@{n.autor?.username}</span>
                        {n.tipo === 'curtida' && ' curtiu seu post'}
                        {n.tipo === 'comentario' && ' comentou em seu post'}
                        {n.tipo === 'seguidor' && ' começou a te seguir'}
                      </p>
                      <span className="text-gray-500 text-[10px] uppercase font-medium">{formatarData(n.created_at)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL COMENTÁRIOS */}
      {showComentarios && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] px-4">
          <div className="bg-black w-full max-w-[500px] rounded-2xl border border-gray-800 max-h-[80vh] flex flex-col shadow-2xl">
            <div className="p-4 border-b border-gray-800 flex justify-between items-center">
              <h3 className="font-bold">Respostas</h3>
              <button onClick={() => setShowComentarios(false)} className="p-1 hover:bg-gray-800 rounded-full transition hover:bg-gray-900"><X size={20}/></button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-4">
              {comentarios.length === 0 ? <p className="text-gray-500 text-center py-10">Nenhuma resposta ainda.</p> : 
                comentarios.map((c: any) => (
                  <div key={c.id} className="flex gap-3 border-b border-gray-900 pb-3">
                    <div className="w-8 h-8 rounded-full bg-zinc-800 overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {c.usuarios?.avatar_url ? <img src={c.usuarios.avatar_url} className="w-full h-full object-cover" /> : <span className="text-xs">{c.usuarios?.username?.[0]}</span>}
                    </div>
                    <div>
                      <div className="flex gap-2 items-center text-sm">
                        <span className="font-bold">{c.usuarios?.full_name}</span>
                        <span className="text-gray-500 text-xs">@{c.usuarios?.username}</span>
                      </div>
                      <p className="text-sm mt-1">{c.conteudo}</p>
                    </div>
                  </div>
                ))
              }
            </div>
            <div className="p-4 border-t border-gray-800 flex gap-2">
              <input value={novoComentario} onChange={(e) => setNovoComentario(e.target.value)} placeholder="Postar sua resposta" className="flex-1 bg-transparent border border-gray-800 rounded-full px-4 py-2 outline-none focus:border-sky-500 text-sm" />
              <button onClick={enviarComentario} disabled={!novoComentario.trim()} className="bg-sky-500 p-2 rounded-full hover:bg-sky-600 transition disabled:opacity-50"><Send size={18} /></button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDIÇÃO */}
      {editando && (
        <div className="fixed inset-0 bg-[#5b7083]/40 backdrop-blur-sm flex items-start justify-center pt-10 z-[100] px-4">
          <div className="bg-black w-full max-w-[600px] rounded-2xl border border-gray-800 flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 flex justify-between border-b border-gray-800 items-center bg-black/80 backdrop-blur-md">
              <div className="flex items-center gap-8">
                <button onClick={() => setEditando(false)} className="p-2 hover:bg-gray-900 rounded-full transition"><X size={20}/></button>
                <h2 className="font-bold text-xl">Editar perfil</h2>
              </div>
              <button onClick={salvarEdicao} disabled={subindoImagem} className="bg-white text-black px-4 py-1.5 rounded-full font-bold hover:bg-gray-200 disabled:opacity-50 transition">Salvar</button>
            </div>
            {/* ... Form de edição segue o mesmo padrão ... */}
            <div className="p-4 space-y-4 overflow-y-auto max-h-[70vh]">
               <div className="relative h-32 bg-zinc-800 rounded-xl overflow-hidden cursor-pointer" onClick={() => bannerInputRef.current?.click()}>
                  {form.banner_url && <img src={form.banner_url} className="w-full h-full object-cover opacity-50" />}
                  <Camera className="absolute inset-0 m-auto text-white" size={30} />
               </div>
               <div className="relative w-24 h-24 -mt-12 ml-4 rounded-full border-4 border-black bg-zinc-700 overflow-hidden cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
                  {form.avatar_url && <img src={form.avatar_url} className="w-full h-full object-cover opacity-50" />}
                  <Camera className="absolute inset-0 m-auto text-white" size={24} />
               </div>
               <input placeholder="Nome completo" value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} className="w-full bg-black border border-gray-800 p-3 rounded-lg outline-none focus:border-sky-500" />
               <textarea placeholder="Bio" value={form.bio} onChange={e => setForm({...form, bio: e.target.value})} className="w-full bg-black border border-gray-800 p-3 rounded-lg outline-none focus:border-sky-500 resize-none h-24" />
            </div>
            <input type="file" hidden ref={avatarInputRef} onChange={(e) => uploadImagem(e, 'avatars')} accept="image/*" />
            <input type="file" hidden ref={bannerInputRef} onChange={(e) => uploadImagem(e, 'banners')} accept="image/*" />
          </div>
        </div>
      )}
    </div>
  )
}
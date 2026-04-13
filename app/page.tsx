'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import {
  Home, User, LogOut, MessageCircle, Heart, Share,
  Bell, Search, X as CloseIcon, Send, ArrowLeft,
  Image as ImageIcon,
} from 'lucide-react'

// ─── Helpers ───────────────────────────────────────────────────────────────

const formatarDataX = (dataStr: string) => {
  if (!dataStr) return ''
  const data = new Date(dataStr)
  const agora = new Date()
  const diff = Math.floor((agora.getTime() - data.getTime()) / 1000)
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}min`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
}

const RenderTextoComMarcacoes = ({
  texto,
  onMencaoClick,
}: {
  texto: string
  onMencaoClick?: (username: string) => void
}) => {
  const partes = texto.split(/(@\w+|#\w+)/g)
  return (
    <p className="mt-1 whitespace-pre-wrap break-words">
      {partes.map((parte, i) => {
        if (parte.startsWith('@'))
          return (
            <span key={i} className="text-sky-400 font-semibold hover:underline cursor-pointer"
              onClick={() => onMencaoClick?.(parte.slice(1))}>
              {parte}
            </span>
          )
        if (parte.startsWith('#'))
          return <span key={i} className="text-sky-400 hover:underline cursor-pointer">{parte}</span>
        return parte
      })}
    </p>
  )
}

// ─── Componente Principal ──────────────────────────────────────────────────

export default function Feed() {
  const [user, setUser] = useState<any>(null)
  const [perfil, setPerfil] = useState<any>(null)
  const [texto, setTexto] = useState('')
  const [imagemPost, setImagemPost] = useState<File | null>(null)
  const [imagemPreview, setImagemPreview] = useState<string | null>(null)
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [comentandoEm, setComentandoEm] = useState<number | null>(null)
  const [novoComentario, setNovoComentario] = useState('')
  const inputImagemRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [notificacoes, setNotificacoes] = useState<any[]>([])
  const [abaAtiva, setAbaAtiva] = useState<'home' | 'notificacoes' | 'mensagens'>('home')

  const [busca, setBusca] = useState('')
  const [usuariosEncontrados, setUsuariosEncontrados] = useState<any[]>([])
  const [mostrarInputBusca, setMostrarInputBusca] = useState(false)
  const buscaRef = useRef<HTMLDivElement>(null)

  const [conversas, setConversas] = useState<any[]>([])
  const [conversaAtiva, setConversaAtiva] = useState<any>(null)
  const [mensagens, setMensagens] = useState<any[]>([])
  const [novaMensagem, setNovaMensagem] = useState('')
  const [mostrarModalNovaConversa, setMostrarModalNovaConversa] = useState(false)
  const [buscaUsuarioDM, setBuscaUsuarioDM] = useState('')
  const [usuariosBuscaDM, setUsuariosBuscaDM] = useState<any[]>([])
  const mensagensEndRef = useRef<HTMLDivElement>(null)

  const [modalCompartilhar, setModalCompartilhar] = useState<any>(null)
  const [buscaDestinatario, setBuscaDestinatario] = useState('')
  const [usuariosBuscaCompartilhar, setUsuariosBuscaCompartilhar] = useState<any[]>([])

  const [sugestoesMencao, setSugestoesMencao] = useState<any[]>([])
  const [termoBuscaMencao, setTermoBuscaMencao] = useState('')
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false)

  // Refs para usar dentro de closures de Realtime sem recriar canais
  const userRef = useRef<any>(null)
  const conversaAtivaRef = useRef<any>(null)

  const router = useRouter()

  // ─── Fetch com useCallback ─────────────────────────────────────────────
  // useCallback garante referência estável — o canal Realtime sempre chama
  // a versão atual da função sem precisar recriar a subscription.

  const fetchPosts = useCallback(async () => {
    const { data: postsData } = await supabase
      .from('posts')
      .select('*, usuarios(username, full_name, avatar_url)')
      .order('created_at', { ascending: false })
    const { data: curtidasData } = await supabase.from('curtidas').select('*')
    const { data: comentariosData } = await supabase
      .from('comentarios')
      .select('*, usuarios(username, avatar_url)')
      .order('created_at', { ascending: true })

    setPosts(
      postsData?.map(post => ({
        ...post,
        lista_curtidas: curtidasData?.filter(c => c.post_id === post.id) || [],
        comentarios: comentariosData?.filter(c => c.post_id === post.id) || [],
      })) || []
    )
  }, [])

  const fetchNotificacoes = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('notificações')
      .select('*, autor:autor_id(username, avatar_url)')
      .eq('usuario_id', userId)
      .order('created_at', { ascending: false })
    setNotificacoes(data || [])
  }, [])

  const fetchConversas = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('mensagens')
      .select('*, remetente:remetente_id(id, username, avatar_url, full_name), destinatario:destinatario_id(id, username, avatar_url, full_name)')
      .or(`remetente_id.eq.${userId},destinatario_id.eq.${userId}`)
      .order('created_at', { ascending: false })

    if (!data) return

    const mapa = new Map<string, any>()
    data.forEach(msg => {
      const outroId = msg.remetente_id === userId ? msg.destinatario_id : msg.remetente_id
      const outroUsuario = msg.remetente_id === userId ? msg.destinatario : msg.remetente
      if (!mapa.has(outroId)) {
        mapa.set(outroId, { id: outroId, usuario: outroUsuario, ultimaMensagem: msg, naoLidas: 0 })
      }
      if (!msg.lida && msg.destinatario_id === userId) {
        const conv = mapa.get(outroId)!
        conv.naoLidas = (conv.naoLidas || 0) + 1
        mapa.set(outroId, conv)
      }
    })
    setConversas(Array.from(mapa.values()))
  }, [])

  const fetchMensagens = useCallback(async (outroUserId: string) => {
    const uid = userRef.current?.id
    if (!uid) return
    const { data } = await supabase
      .from('mensagens')
      .select('*')
      .or(`and(remetente_id.eq.${uid},destinatario_id.eq.${outroUserId}),and(remetente_id.eq.${outroUserId},destinatario_id.eq.${uid})`)
      .order('created_at', { ascending: true })
    setMensagens(data || [])
    await supabase.from('mensagens').update({ lida: true })
      .eq('destinatario_id', uid).eq('remetente_id', outroUserId).eq('lida', false)
    fetchConversas(uid)
  }, [fetchConversas])

  // ─── Inicialização + Canais Realtime ───────────────────────────────────

  useEffect(() => {
    let canalPosts: any
    let canalNotifs: any
    let canalMsgs: any

    const inicializar = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data: p } = await supabase.from('usuarios').select('*').eq('id', session.user.id).single()
      if (!p) { await supabase.auth.signOut(); router.push('/login'); return }

      userRef.current = session.user
      setUser(session.user)
      setPerfil(p)

      await fetchPosts()
      await fetchNotificacoes(session.user.id)
      await fetchConversas(session.user.id)
      setLoading(false)

      // Posts: escuta INSERT/UPDATE/DELETE em posts, curtidas e comentarios
      supabase.removeChannel(supabase.channel('feed-realtime'))
      canalPosts = supabase.channel('feed-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, fetchPosts)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'curtidas' }, fetchPosts)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'comentarios' }, fetchPosts)
        .subscribe()

      // Notificações: só INSERT filtrado pelo usuário logado
      const nomeNotifs = `notifs-${session.user.id}`
      supabase.removeChannel(supabase.channel(nomeNotifs))
      canalNotifs = supabase.channel(nomeNotifs)
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notificações', filter: `usuario_id=eq.${session.user.id}` },
          async payload => {
            const { data: autor } = await supabase.from('usuarios')
              .select('username, avatar_url').eq('id', payload.new.autor_id).single()
            setNotificacoes(prev => [{ ...payload.new, autor }, ...prev])
          })
        .subscribe()

      // Mensagens recebidas: INSERT filtrado pelo destinatário
      const nomeMsgs = `msgs-${session.user.id}`
      supabase.removeChannel(supabase.channel(nomeMsgs))
      canalMsgs = supabase.channel(nomeMsgs)
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'mensagens', filter: `destinatario_id=eq.${session.user.id}` },
          payload => {
            fetchConversas(session.user.id)
            // conversaAtivaRef nunca fica stale — sempre aponta pro valor atual
            if (conversaAtivaRef.current?.id === payload.new.remetente_id) {
              setMensagens(prev => [...prev, payload.new])
            }
          })
        .subscribe()
    }

    inicializar()

    return () => {
      if (canalPosts) supabase.removeChannel(canalPosts)
      if (canalNotifs) supabase.removeChannel(canalNotifs)
      if (canalMsgs) supabase.removeChannel(canalMsgs)
    }
  }, [router, fetchPosts, fetchNotificacoes, fetchConversas])

  // Mantém ref de conversaAtiva sempre atual (sem recriar canais)
  useEffect(() => { conversaAtivaRef.current = conversaAtiva }, [conversaAtiva])

  // Scroll chat
  useEffect(() => { mensagensEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [mensagens])

  // Fecha busca ao clicar fora
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (buscaRef.current && !buscaRef.current.contains(e.target as Node)) {
        setMostrarInputBusca(false); setUsuariosEncontrados([]); setBusca('')
      }
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  // Buscas com debounce
  useEffect(() => {
    const t = setTimeout(async () => {
      if (busca.length < 2) { setUsuariosEncontrados([]); return }
      const { data } = await supabase.from('usuarios').select('username, full_name, avatar_url').ilike('username', `%${busca}%`).limit(5)
      setUsuariosEncontrados(data || [])
    }, 300)
    return () => clearTimeout(t)
  }, [busca])

  useEffect(() => {
    const t = setTimeout(async () => {
      if (buscaUsuarioDM.length < 2) { setUsuariosBuscaDM([]); return }
      const { data } = await supabase.from('usuarios').select('id, username, full_name, avatar_url').ilike('username', `%${buscaUsuarioDM}%`).limit(5)
      setUsuariosBuscaDM(data || [])
    }, 300)
    return () => clearTimeout(t)
  }, [buscaUsuarioDM])

  useEffect(() => {
    const t = setTimeout(async () => {
      if (buscaDestinatario.length < 2) { setUsuariosBuscaCompartilhar([]); return }
      const { data } = await supabase.from('usuarios').select('id, username, full_name, avatar_url').ilike('username', `%${buscaDestinatario}%`).limit(5)
      setUsuariosBuscaCompartilhar(data || [])
    }, 300)
    return () => clearTimeout(t)
  }, [buscaDestinatario])

  useEffect(() => {
    const t = setTimeout(async () => {
      if (termoBuscaMencao.length < 1) { setSugestoesMencao([]); return }
      const { data } = await supabase.from('usuarios').select('id, username, full_name, avatar_url').ilike('username', `%${termoBuscaMencao}%`).limit(5)
      setSugestoesMencao(data || [])
    }, 200)
    return () => clearTimeout(t)
  }, [termoBuscaMencao])

  // ─── Actions ──────────────────────────────────────────────────────────

  const marcarComoLidas = async () => {
    const uid = userRef.current?.id
    if (!uid || !notificacoes.some(n => !n.lida)) return
    await supabase.from('notificações').update({ lida: true }).eq('usuario_id', uid).eq('lida', false)
    setNotificacoes(prev => prev.map(n => ({ ...n, lida: true })))
  }

  const criarNotificacao = async (
    destinatarioId: string,
    tipo: 'curtida' | 'comentario' | 'mensagem' | 'mencao',
    postId?: number
  ) => {
    const uid = userRef.current?.id
    if (!uid || destinatarioId === uid) return
    await supabase.from('notificações').insert({ usuario_id: destinatarioId, autor_id: uid, tipo, post_id: postId || null })
  }

  const gerenciarLike = async (post: any) => {
    const uid = userRef.current?.id
    if (!uid) return
    const euCurti = post.lista_curtidas?.some((c: any) => c.usuario_id === uid)
    if (euCurti) {
      await supabase.from('curtidas').delete().eq('post_id', post.id).eq('usuario_id', uid)
    } else {
      await supabase.from('curtidas').insert([{ post_id: post.id, usuario_id: uid }])
      await criarNotificacao(post.usuario_id, 'curtida', post.id)
    }
    // Realtime já dispara fetchPosts — não precisa chamar manualmente
  }

  const selecionarImagem = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImagemPost(file)
    setImagemPreview(URL.createObjectURL(file))
  }

  const handleTextoChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setTexto(val)
    const cursor = e.target.selectionStart
    const match = val.slice(0, cursor).match(/@(\w*)$/)
    if (match) {
      setTermoBuscaMencao(match[1])
      setMostrarSugestoes(true)
    } else {
      setMostrarSugestoes(false)
      setTermoBuscaMencao('')
      setSugestoesMencao([])
    }
  }

  const selecionarMencao = (username: string) => {
    const cursor = textareaRef.current?.selectionStart ?? texto.length
    const antes = texto.slice(0, cursor).replace(/@(\w*)$/, `@${username} `)
    setTexto(antes + texto.slice(cursor))
    setMostrarSugestoes(false)
    setSugestoesMencao([])
    setTermoBuscaMencao('')
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  const notificarMencoes = async (textoPost: string, postId: number) => {
    const mencoes = textoPost.match(/@(\w+)/g)
    if (!mencoes) return
    for (const username of [...new Set(mencoes.map(m => m.slice(1)))]) {
      const { data } = await supabase.from('usuarios').select('id').eq('username', username).single()
      if (data) await criarNotificacao(data.id, 'mencao', postId)
    }
  }

  const enviarPost = async () => {
    const uid = userRef.current?.id
    if (!uid || (!texto.trim() && !imagemPost)) return

    let imagemUrl: string | null = null
    if (imagemPost) {
      const nomeArquivo = `${uid}/${Date.now()}-${imagemPost.name}`
      const { error: uploadError } = await supabase.storage.from('posts-imagens').upload(nomeArquivo, imagemPost)
      if (uploadError) { console.error('Upload falhou:', uploadError); return }
      const { data: urlData } = supabase.storage.from('posts-imagens').getPublicUrl(nomeArquivo)
      imagemUrl = urlData.publicUrl
    }

    const { data: postCriado, error } = await supabase
      .from('posts')
      .insert([{ conteudo: texto, usuario_id: uid, imagem_url: imagemUrl }])
      .select('id')
      .single()

    if (!error && postCriado) {
      await notificarMencoes(texto, postCriado.id)
      setTexto('')
      setImagemPost(null)
      setImagemPreview(null)
      // Realtime cuida de atualizar o feed
    }
  }

  const enviarComentario = async (post: any) => {
    const uid = userRef.current?.id
    if (!novoComentario.trim() || !uid) return
    const { error } = await supabase.from('comentarios')
      .insert([{ post_id: post.id, usuario_id: uid, conteudo: novoComentario }])
    if (!error) {
      await criarNotificacao(post.usuario_id, 'comentario', post.id)
      setNovoComentario('')
      // Realtime cuida do fetchPosts
    }
  }

  const enviarMensagem = async () => {
    const uid = userRef.current?.id
    if (!novaMensagem.trim() || !conversaAtiva || !uid) return
    // Optimistic update: aparece na tela antes da resposta do servidor
    const msgLocal = {
      remetente_id: uid,
      destinatario_id: conversaAtiva.id,
      conteudo: novaMensagem,
      created_at: new Date().toISOString(),
      lida: false,
    }
    setMensagens(prev => [...prev, msgLocal])
    setNovaMensagem('')
    await supabase.from('mensagens').insert([{ remetente_id: uid, destinatario_id: conversaAtiva.id, conteudo: novaMensagem }])
    fetchConversas(uid)
  }

  const abrirConversa = (outroUsuario: any) => {
    setConversaAtiva(outroUsuario)
    fetchMensagens(outroUsuario.id)
    setMostrarModalNovaConversa(false)
    setBuscaUsuarioDM('')
    setUsuariosBuscaDM([])
  }

  const compartilharViaMsg = async (destinatario: any, post: any) => {
    const uid = userRef.current?.id
    if (!uid) return
    await supabase.from('mensagens').insert([{
      remetente_id: uid,
      destinatario_id: destinatario.id,
      conteudo: `Olha esse post de @${post.usuarios?.username}: "${post.conteudo}"`,
    }])
    setModalCompartilhar(null)
    setBuscaDestinatario('')
    setUsuariosBuscaCompartilhar([])
  }

  // ─── Sub-components ───────────────────────────────────────────────────

  const RenderAvatar = ({ url, username, size = 'w-10 h-10' }: any) => (
    <div className={`${size} bg-sky-600 rounded-full flex items-center justify-center font-bold uppercase shrink-0 cursor-pointer overflow-hidden border border-gray-800`}>
      {url ? <img src={url} alt={username} className="w-full h-full object-cover" /> : <span>{username?.[0]}</span>}
    </div>
  )

  if (loading)
    return <div className="bg-black min-h-screen text-white flex items-center justify-center font-bold text-4xl italic">X</div>

  const qndNaoLidas = notificacoes.filter(n => !n.lida).length
  const totalMsgNaoLidas = conversas.reduce((acc, c) => acc + (c.naoLidas || 0), 0)

  return (
    <div className="flex min-h-screen bg-black text-[#e7e9ea] max-w-[1250px] mx-auto font-sans">

      {/* ── SIDEBAR ── */}
      <aside className="w-20 xl:w-64 p-2 border-r border-gray-800 sticky top-0 h-screen flex flex-col justify-between shrink-0">
        <div className="space-y-4">
          <div className="p-3 text-3xl font-bold cursor-pointer hover:bg-gray-900 w-fit rounded-full transition"
            onClick={() => { setAbaAtiva('home'); setConversaAtiva(null) }}>X</div>
          <nav className="text-xl font-bold space-y-2">

            <div onClick={() => { setAbaAtiva('home'); setConversaAtiva(null) }}
              className="flex items-center gap-5 p-3 hover:bg-gray-900 rounded-full cursor-pointer transition">
              <Home size={28} /> <span className="hidden xl:inline">Home</span>
            </div>

            {/* Busca */}
            <div className="relative" ref={buscaRef}>
              {!mostrarInputBusca ? (
                <div onClick={() => setMostrarInputBusca(true)}
                  className="flex items-center gap-5 p-3 hover:bg-gray-900 rounded-full cursor-pointer transition">
                  <Search size={28} /> <span className="hidden xl:inline">Buscar</span>
                </div>
              ) : (
                <div className="px-3 py-2">
                  <div className="flex items-center gap-2 bg-[#202327] p-3 rounded-full border border-sky-500">
                    <Search size={20} className="text-sky-500 shrink-0" />
                    <input autoFocus value={busca} onChange={e => setBusca(e.target.value)}
                      placeholder="Buscar..." className="bg-transparent outline-none text-sm w-full" />
                  </div>
                  {usuariosEncontrados.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-2 bg-black border border-gray-800 rounded-xl shadow-2xl z-50 overflow-hidden">
                      {usuariosEncontrados.map(u => (
                        <div key={u.username}
                          onClick={() => { router.push(`/perfil/${u.username}`); setMostrarInputBusca(false) }}
                          className="flex items-center gap-3 p-3 hover:bg-white/5 cursor-pointer">
                          <RenderAvatar url={u.avatar_url} username={u.username} size="w-8 h-8" />
                          <div className="text-sm">
                            <p className="font-bold">{u.full_name}</p>
                            <p className="text-gray-500 text-xs">@{u.username}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div onClick={() => router.push(`/perfil/${perfil?.username}`)}
              className="flex items-center gap-5 p-3 hover:bg-gray-900 rounded-full cursor-pointer transition">
              <User size={28} /> <span className="hidden xl:inline">Perfil</span>
            </div>

            {/* Notificações */}
            <div onClick={() => { setAbaAtiva('notificacoes'); marcarComoLidas() }}
              className="flex items-center gap-5 p-3 hover:bg-gray-900 rounded-full cursor-pointer transition relative">
              <div className="relative">
                <Bell size={28} />
                {qndNaoLidas > 0 && (
                  <div className="absolute -top-1 -right-1 bg-sky-500 text-[10px] w-5 h-5 flex items-center justify-center rounded-full border-2 border-black font-bold">
                    {qndNaoLidas}
                  </div>
                )}
              </div>
              <span className="hidden xl:inline">Notificações</span>
            </div>

            {/* Mensagens */}
            <div onClick={() => { setAbaAtiva('mensagens'); setConversaAtiva(null) }}
              className="flex items-center gap-5 p-3 hover:bg-gray-900 rounded-full cursor-pointer transition relative">
              <div className="relative">
                <MessageCircle size={28} />
                {totalMsgNaoLidas > 0 && (
                  <div className="absolute -top-1 -right-1 bg-sky-500 text-[10px] w-5 h-5 flex items-center justify-center rounded-full border-2 border-black font-bold">
                    {totalMsgNaoLidas}
                  </div>
                )}
              </div>
              <span className="hidden xl:inline">Mensagens</span>
            </div>

          </nav>
        </div>
        <button onClick={() => { supabase.auth.signOut(); router.push('/login') }}
          className="mb-4 p-3 text-red-500 hover:bg-red-950/20 rounded-full flex gap-4 font-bold items-center transition">
          <LogOut size={24} /> <span className="hidden xl:inline">Sair</span>
        </button>
      </aside>

      {/* ── ÁREA CENTRAL ── */}
      <main className="flex-1 border-r border-gray-800 max-w-[600px] w-full">

        {/* Header */}
        <div className="p-4 border-b border-gray-800 sticky top-0 bg-black/80 backdrop-blur-md z-10 flex justify-between items-center">
          {abaAtiva === 'mensagens' && conversaAtiva ? (
            <div className="flex items-center gap-3">
              <button onClick={() => setConversaAtiva(null)} className="hover:bg-gray-900 p-2 rounded-full">
                <ArrowLeft size={20} />
              </button>
              <RenderAvatar url={conversaAtiva.usuario?.avatar_url} username={conversaAtiva.usuario?.username} size="w-8 h-8" />
              <div>
                <p className="font-bold text-sm">{conversaAtiva.usuario?.full_name}</p>
                <p className="text-gray-500 text-xs">@{conversaAtiva.usuario?.username}</p>
              </div>
            </div>
          ) : (
            <span className="font-bold text-xl">
              {abaAtiva === 'home' && 'Página Inicial'}
              {abaAtiva === 'notificacoes' && 'Notificações'}
              {abaAtiva === 'mensagens' && 'Mensagens'}
            </span>
          )}
          {abaAtiva === 'notificacoes' && (
            <button onClick={() => setAbaAtiva('home')} className="hover:bg-gray-900 p-2 rounded-full">
              <CloseIcon size={20} />
            </button>
          )}
          {abaAtiva === 'mensagens' && !conversaAtiva && (
            <button onClick={() => setMostrarModalNovaConversa(true)}
              className="bg-sky-500 hover:bg-sky-600 px-4 py-1.5 rounded-full font-bold text-sm transition">
              Nova mensagem
            </button>
          )}
        </div>

        {/* ── HOME ── */}
        {abaAtiva === 'home' && (
          <>
            {/* Composer */}
            <div className="p-4 border-b border-gray-800 flex gap-4">
              <RenderAvatar url={perfil?.avatar_url} username={perfil?.username} />
              <div className="flex-1">
                <div className="relative">
                  <textarea
                    ref={textareaRef}
                    value={texto}
                    onChange={handleTextoChange}
                    className="w-full bg-transparent text-xl outline-none placeholder-gray-600 resize-none mt-2"
                    placeholder="O que está acontecendo? Use #hashtags e @mencoes!"
                    rows={2}
                  />
                  {mostrarSugestoes && sugestoesMencao.length > 0 && (
                    <div className="absolute left-0 top-full mt-1 bg-[#0f0f0f] border border-gray-800 rounded-xl shadow-2xl z-50 w-64 overflow-hidden">
                      {sugestoesMencao.map(u => (
                        <div key={u.id}
                          onMouseDown={e => { e.preventDefault(); selecionarMencao(u.username) }}
                          className="flex items-center gap-3 p-3 hover:bg-white/5 cursor-pointer">
                          <RenderAvatar url={u.avatar_url} username={u.username} size="w-8 h-8" />
                          <div className="text-sm">
                            <p className="font-bold">{u.full_name}</p>
                            <p className="text-gray-500 text-xs">@{u.username}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {imagemPreview && (
                  <div className="relative mt-2 rounded-xl overflow-hidden border border-gray-800">
                    <img src={imagemPreview} alt="preview" className="w-full max-h-72 object-cover" />
                    <button onClick={() => { setImagemPost(null); setImagemPreview(null) }}
                      className="absolute top-2 right-2 bg-black/70 rounded-full p-1 hover:bg-black">
                      <CloseIcon size={16} />
                    </button>
                  </div>
                )}

                <div className="flex justify-between pt-3 border-t border-gray-800 items-center">
                  <button onClick={() => inputImagemRef.current?.click()}
                    className="text-sky-500 hover:bg-sky-500/10 p-2 rounded-full transition">
                    <ImageIcon size={20} />
                  </button>
                  <input ref={inputImagemRef} type="file" accept="image/*" onChange={selecionarImagem} className="hidden" />
                  <button onClick={enviarPost}
                    className="bg-sky-500 hover:bg-sky-600 px-5 py-2 rounded-full font-bold transition">
                    Postar
                  </button>
                </div>
              </div>
            </div>

            {/* Feed de posts */}
            <div className="divide-y divide-gray-800">
              {posts.map(post => {
                const jaCurti = post.lista_curtidas?.some((c: any) => c.usuario_id === user?.id)
                return (
                  <div key={post.id} className="p-4 hover:bg-white/[0.02] transition">
                    <div className="flex gap-3">
                      <RenderAvatar url={post.usuarios?.avatar_url} username={post.usuarios?.username} />
                      <div className="flex-1">
                        <div className="flex gap-1.5 items-center">
                          <span className="font-bold hover:underline cursor-pointer"
                            onClick={() => router.push(`/perfil/${post.usuarios?.username}`)}>
                            @{post.usuarios?.username}
                          </span>
                          <span className="text-gray-500 text-sm">· {formatarDataX(post.created_at)}</span>
                        </div>

                        <RenderTextoComMarcacoes texto={post.conteudo || ''} onMencaoClick={u => router.push(`/perfil/${u}`)} />

                        {post.imagem_url && (
                          <div className="mt-2 rounded-xl overflow-hidden border border-gray-800">
                            <img src={post.imagem_url} alt="imagem" className="w-full max-h-80 object-cover" />
                          </div>
                        )}

                        <div className="flex justify-between mt-3 text-gray-500 max-w-md">
                          <div onClick={() => setComentandoEm(comentandoEm === post.id ? null : post.id)}
                            className="flex items-center gap-2 cursor-pointer hover:text-sky-500 transition">
                            <MessageCircle size={18} />
                            <span className="text-xs">{post.comentarios?.length}</span>
                          </div>
                          <div onClick={() => gerenciarLike(post)}
                            className={`flex items-center gap-2 cursor-pointer hover:text-pink-500 transition ${jaCurti ? 'text-pink-500' : ''}`}>
                            <Heart size={18} className={jaCurti ? 'fill-pink-500' : ''} />
                            <span className="text-xs">{post.lista_curtidas?.length}</span>
                          </div>
                          <div onClick={() => { setModalCompartilhar(post); setBuscaDestinatario(''); setUsuariosBuscaCompartilhar([]) }}
                            className="flex items-center gap-2 cursor-pointer hover:text-green-500 transition">
                            <Share size={18} />
                          </div>
                        </div>

                        {comentandoEm === post.id && (
                          <div className="mt-4 space-y-4">
                            <div className="flex gap-3">
                              <RenderAvatar url={perfil?.avatar_url} username={perfil?.username} size="w-8 h-8" />
                              <div className="flex-1 flex gap-2">
                                <input value={novoComentario} onChange={e => setNovoComentario(e.target.value)}
                                  onKeyDown={e => e.key === 'Enter' && enviarComentario(post)}
                                  className="flex-1 bg-zinc-900 rounded-full px-4 py-1 text-sm outline-none border border-transparent focus:border-sky-500"
                                  placeholder="Sua resposta..." />
                                <button onClick={() => enviarComentario(post)}
                                  className="bg-sky-500 px-4 py-1 rounded-full text-xs font-bold hover:bg-sky-600 transition">
                                  Responder
                                </button>
                              </div>
                            </div>
                            {post.comentarios?.map((c: any) => (
                              <div key={c.id} className="flex gap-3 text-sm bg-white/5 p-3 rounded-2xl">
                                <RenderAvatar url={c.usuarios?.avatar_url} username={c.usuarios?.username} size="w-7 h-7" />
                                <div className="flex-1">
                                  <p className="font-bold">@{c.usuarios?.username}</p>
                                  <p className="text-gray-200">{c.conteudo}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* ── NOTIFICAÇÕES ── */}
        {abaAtiva === 'notificacoes' && (
          <div className="divide-y divide-gray-800">
            {notificacoes.length === 0 ? (
              <p className="p-10 text-center text-gray-500 italic font-medium">Nada por aqui ainda.</p>
            ) : (
              notificacoes.map(n => (
                <div key={n.id}
                  className={`p-4 flex gap-4 items-start transition ${!n.lida ? 'bg-sky-500/10' : 'hover:bg-white/[0.02]'}`}>
                  <div className="mt-1 shrink-0">
                    {n.tipo === 'curtida' && <Heart size={22} className="text-pink-500 fill-pink-500" />}
                    {n.tipo === 'comentario' && <MessageCircle size={22} className="text-sky-500 fill-sky-500" />}
                    {n.tipo === 'seguidor' && <User size={22} className="text-sky-400" />}
                    {n.tipo === 'mensagem' && <Send size={22} className="text-green-400" />}
                    {n.tipo === 'mencao' && <span className="text-sky-400 font-bold text-lg leading-none">@</span>}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 cursor-pointer"
                      onClick={() => router.push(`/perfil/${n.autor?.username}`)}>
                      <RenderAvatar url={n.autor?.avatar_url} username={n.autor?.username} size="w-8 h-8" />
                      <span className="font-bold text-sm hover:underline">@{n.autor?.username}</span>
                    </div>
                    <p className="text-sm text-gray-300">
                      {n.tipo === 'curtida' && 'curtiu seu post'}
                      {n.tipo === 'comentario' && 'comentou no seu post'}
                      {n.tipo === 'seguidor' && 'começou a te seguir'}
                      {n.tipo === 'mensagem' && 'te enviou uma mensagem'}
                      {n.tipo === 'mencao' && 'te mencionou em um post'}
                    </p>
                    <span className="text-[10px] text-gray-500 uppercase font-bold mt-1 block">{formatarDataX(n.created_at)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── MENSAGENS ── */}
        {abaAtiva === 'mensagens' && (
          <>
            {!conversaAtiva ? (
              <div className="divide-y divide-gray-800">
                {conversas.length === 0 ? (
                  <p className="p-10 text-center text-gray-500 italic">Nenhuma conversa ainda.</p>
                ) : (
                  conversas.map(conversa => (
                    <div key={conversa.id} onClick={() => abrirConversa(conversa)}
                      className="p-4 flex gap-3 hover:bg-white/[0.02] cursor-pointer transition items-center">
                      <div className="relative">
                        <RenderAvatar url={conversa.usuario?.avatar_url} username={conversa.usuario?.username} />
                        {conversa.naoLidas > 0 && (
                          <div className="absolute -top-1 -right-1 bg-sky-500 text-[10px] w-4 h-4 flex items-center justify-center rounded-full border-2 border-black font-bold">
                            {conversa.naoLidas}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <p className="font-bold text-sm">{conversa.usuario?.full_name}</p>
                          <span className="text-gray-500 text-xs">{formatarDataX(conversa.ultimaMensagem?.created_at)}</span>
                        </div>
                        <p className={`text-sm truncate ${conversa.naoLidas > 0 ? 'text-white font-semibold' : 'text-gray-500'}`}>
                          {conversa.ultimaMensagem?.conteudo}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="flex flex-col h-[calc(100vh-65px)]">
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {mensagens.map((msg, i) => {
                    const euEnviei = msg.remetente_id === user?.id
                    return (
                      <div key={i} className={`flex ${euEnviei ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${euEnviei ? 'bg-sky-500 text-white rounded-br-sm' : 'bg-[#202327] text-[#e7e9ea] rounded-bl-sm'}`}>
                          <p>{msg.conteudo}</p>
                          <p className={`text-[10px] mt-1 ${euEnviei ? 'text-sky-200' : 'text-gray-500'}`}>
                            {formatarDataX(msg.created_at)}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={mensagensEndRef} />
                </div>
                <div className="p-4 border-t border-gray-800 flex gap-3 items-center">
                  <input value={novaMensagem} onChange={e => setNovaMensagem(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && enviarMensagem()}
                    className="flex-1 bg-[#202327] rounded-full px-4 py-2.5 text-sm outline-none border border-transparent focus:border-sky-500"
                    placeholder="Nova mensagem..." />
                  <button onClick={enviarMensagem}
                    className="bg-sky-500 hover:bg-sky-600 p-2.5 rounded-full transition shrink-0">
                    <Send size={18} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* ── MODAL: Nova Conversa ── */}
      {mostrarModalNovaConversa && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={() => setMostrarModalNovaConversa(false)}>
          <div className="bg-[#0f0f0f] border border-gray-800 rounded-2xl w-full max-w-sm shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h2 className="font-bold text-lg">Nova mensagem</h2>
              <button onClick={() => setMostrarModalNovaConversa(false)} className="hover:bg-gray-900 p-2 rounded-full">
                <CloseIcon size={18} />
              </button>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-2 bg-[#202327] p-3 rounded-full border border-sky-500">
                <Search size={18} className="text-sky-500 shrink-0" />
                <input autoFocus value={buscaUsuarioDM} onChange={e => setBuscaUsuarioDM(e.target.value)}
                  placeholder="Buscar usuário..." className="bg-transparent outline-none text-sm w-full" />
              </div>
              <div className="mt-2 space-y-1">
                {usuariosBuscaDM.map(u => (
                  <div key={u.id}
                    onClick={() => { abrirConversa({ id: u.id, usuario: u }); setAbaAtiva('mensagens') }}
                    className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl cursor-pointer">
                    <RenderAvatar url={u.avatar_url} username={u.username} size="w-9 h-9" />
                    <div>
                      <p className="font-bold text-sm">{u.full_name}</p>
                      <p className="text-gray-500 text-xs">@{u.username}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Compartilhar ── */}
      {modalCompartilhar && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={() => setModalCompartilhar(null)}>
          <div className="bg-[#0f0f0f] border border-gray-800 rounded-2xl w-full max-w-sm shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h2 className="font-bold text-lg">Compartilhar via mensagem</h2>
              <button onClick={() => setModalCompartilhar(null)} className="hover:bg-gray-900 p-2 rounded-full">
                <CloseIcon size={18} />
              </button>
            </div>
            <div className="mx-4 mt-4 p-3 bg-white/5 border border-gray-800 rounded-xl text-sm text-gray-400 line-clamp-2">
              <span className="font-bold text-white">@{modalCompartilhar.usuarios?.username}</span> · {modalCompartilhar.conteudo}
            </div>
            <div className="p-4">
              <div className="flex items-center gap-2 bg-[#202327] p-3 rounded-full border border-sky-500">
                <Search size={18} className="text-sky-500 shrink-0" />
                <input autoFocus value={buscaDestinatario} onChange={e => setBuscaDestinatario(e.target.value)}
                  placeholder="Buscar destinatário..." className="bg-transparent outline-none text-sm w-full" />
              </div>
              <div className="mt-2 space-y-1">
                {usuariosBuscaCompartilhar.map(u => (
                  <div key={u.id} onClick={() => compartilharViaMsg(u, modalCompartilhar)}
                    className="flex items-center justify-between p-3 hover:bg-white/5 rounded-xl cursor-pointer">
                    <div className="flex items-center gap-3">
                      <RenderAvatar url={u.avatar_url} username={u.username} size="w-9 h-9" />
                      <div>
                        <p className="font-bold text-sm">{u.full_name}</p>
                        <p className="text-gray-500 text-xs">@{u.username}</p>
                      </div>
                    </div>
                    <button className="bg-sky-500 hover:bg-sky-600 px-3 py-1 rounded-full text-xs font-bold transition">
                      Enviar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
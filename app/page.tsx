'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase' 
import { useRouter } from 'next/navigation'
import { Home, User, LogOut, MessageCircle, Heart, Share, MoreHorizontal } from 'lucide-react'

export default function Feed() {
  const [user, setUser] = useState<any>(null)
  const [perfil, setPerfil] = useState<any>(null)
  const [texto, setTexto] = useState('')
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [comentandoEm, setComentandoEm] = useState<number | null>(null)
  const [novoComentario, setNovoComentario] = useState('')
  const router = useRouter()

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return; }

      const { data: p } = await supabase.from('usuarios').select('*').eq('id', session.user.id).single()
      
      if (!p) {
        await supabase.auth.signOut(); router.push('/login')
      } else {
        setUser(session.user); 
        setPerfil(p); 
        fetchPosts(session.user.id);
      }
      setLoading(false)
    }
    checkUser()
  }, [router])

  const fetchPosts = async (userId?: string) => {
    const idParaVerificar = userId || user?.id;

    // 1. Busca os posts
    const { data: postsData, error: postsError } = await supabase
      .from('posts')
      .select('*, usuarios(username, full_name)')
      .order('created_at', { ascending: false });

    if (postsError) {
      console.error("Erro nos posts:", postsError.message);
      return;
    }

    // 2. Busca curtidas
    const { data: curtidasData } = await supabase.from('curtidas').select('*');

    // 3. Busca comentários (Query robusta para evitar erro 400)
    const { data: comentariosData, error: comError } = await supabase
      .from('comentarios')
      .select('id, post_id, conteudo, usuario_id, usuarios(username)');

    if (comError) console.error("Erro nos comentários:", comError.message);

    // 4. Monta o Feed
    const feedFormatado = postsData?.map(post => ({
      ...post,
      lista_curtidas: curtidasData?.filter(c => c.post_id === post.id) || [],
      comentarios: comentariosData?.filter(c => c.post_id === post.id) || []
    }));

    setPosts(feedFormatado || []);
  }

  const enviarPost = async () => {
    if (!texto.trim()) return
    const { error } = await supabase.from('posts').insert([{ conteudo: texto, usuario_id: user.id }])
    if (!error) { setTexto(''); fetchPosts(user.id) }
  }

  const gerenciarLike = async (postId: number) => {
    if (!user) return;
    const post = posts.find(p => p.id === postId);
    const euCurti = post.lista_curtidas?.some((c: any) => c.usuario_id === user.id);

    if (euCurti) {
      const { error: errorDel } = await supabase.from('curtidas').delete().eq('post_id', postId).eq('usuario_id', user.id);
      if (!errorDel) {
        await supabase.from('posts').update({ likes_count: Math.max(0, (post.likes_count || 0) - 1) }).eq('id', postId);
      }
    } else {
      const { error: errorIns } = await supabase.from('curtidas').insert([{ post_id: postId, usuario_id: user.id }]);
      if (!errorIns) {
        await supabase.from('posts').update({ likes_count: (post.likes_count || 0) + 1 }).eq('id', postId);
      }
    }
    fetchPosts(user.id);
  }

  const enviarComentario = async (postId: number) => {
    if (!novoComentario.trim() || !user) return;
    
    const { error } = await supabase.from('comentarios').insert([
      { post_id: postId, usuario_id: user.id, conteudo: novoComentario }
    ]);
    
    if (error) {
      console.error("Erro ao comentar:", error.message);
      alert("Erro ao comentar: " + error.message);
    } else {
      setNovoComentario('');
      fetchPosts(user.id);
    }
  }

  if (loading) return <div className="bg-black min-h-screen text-white flex items-center justify-center font-bold text-4xl italic">X</div>

  return (
    <div className="flex min-h-screen bg-black text-[#e7e9ea] max-w-[1250px] mx-auto font-sans">
      {/* Sidebar */}
      <aside className="w-20 xl:w-64 p-2 border-r border-gray-800 sticky top-0 h-screen flex flex-col justify-between shrink-0">
        <div className="space-y-4">
          <div className="p-3 text-3xl font-bold">X</div>
          <nav className="text-xl font-bold space-y-2">
            <div className="flex items-center gap-5 p-3 hover:bg-gray-900 rounded-full cursor-pointer transition"><Home size={28}/> <span className="hidden xl:inline">Home</span></div>
            <div className="flex items-center gap-5 p-3 hover:bg-gray-900 rounded-full cursor-pointer transition"><User size={28}/> <span className="hidden xl:inline">Perfil</span></div>
          </nav>
        </div>
        <button onClick={() => { supabase.auth.signOut(); router.push('/login') }} className="mb-4 p-3 text-red-500 hover:bg-red-950/20 rounded-full flex gap-4 font-bold items-center justify-center xl:justify-start">
          <LogOut size={24}/> <span className="hidden xl:inline">Sair</span>
        </button>
      </aside>

      {/* Feed */}
      <main className="flex-1 border-r border-gray-800 max-w-[600px] w-full">
        <div className="p-4 border-b border-gray-800 sticky top-0 bg-black/80 backdrop-blur-md z-10 font-bold text-xl">Página Inicial</div>
        
        {/* Input de Post */}
        <div className="p-4 border-b border-gray-800 flex gap-4">
          <div className="w-10 h-10 bg-sky-600 rounded-full flex items-center justify-center font-bold uppercase shrink-0">{perfil?.username?.[0]}</div>
          <div className="flex-1">
            <textarea value={texto} onChange={e => setTexto(e.target.value)} className="w-full bg-transparent text-xl outline-none placeholder-gray-600 resize-none mt-2" placeholder="O que está acontecendo?" rows={2} />
            <div className="flex justify-end pt-3 border-t border-gray-800">
              <button onClick={enviarPost} className="bg-sky-500 hover:bg-sky-600 px-5 py-2 rounded-full font-bold transition">Postar</button>
            </div>
          </div>
        </div>

        {/* Lista de Tweets */}
        <div className="divide-y divide-gray-800">
          {posts.map(post => {
            const euCurti = post.lista_curtidas?.some((c: any) => c.usuario_id === user?.id);
            
            return (
              <div key={post.id} className="p-4 hover:bg-white/[0.02] transition duration-200">
                <div className="flex gap-3">
                  <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center font-bold text-sm uppercase shrink-0">{post.usuarios?.username?.[0]}</div>
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <div className="flex gap-1.5 items-center">
                        <span className="font-bold hover:underline cursor-pointer">{post.usuarios?.full_name}</span>
                        <span className="text-gray-500 text-sm">@{post.usuarios?.username}</span>
                      </div>
                      <MoreHorizontal size={18} className="text-gray-500 cursor-pointer" />
                    </div>
                    <p className="mt-1 text-[15px] leading-normal">{post.conteudo}</p>
                    
                    {/* Botões de Ação */}
                    <div className="flex justify-between mt-3 text-gray-500 max-w-md">
                      <div onClick={() => setComentandoEm(comentandoEm === post.id ? null : post.id)} className="flex items-center gap-2 group cursor-pointer hover:text-sky-500 transition">
                        <div className="p-2 group-hover:bg-sky-500/10 rounded-full"><MessageCircle size={18} /></div>
                        <span className="text-xs">{post.comentarios?.length || 0}</span>
                      </div>
                      
                      <div onClick={() => gerenciarLike(post.id)} className={`flex items-center gap-2 group cursor-pointer hover:text-pink-500 transition ${euCurti ? 'text-pink-500' : ''}`}>
                        <div className="p-2 group-hover:bg-pink-500/10 rounded-full">
                          <Heart size={18} className={euCurti ? "fill-pink-500 text-pink-500" : ""} />
                        </div>
                        <span className="text-xs">{post.likes_count || 0}</span>
                      </div>

                      <div className="p-2 hover:bg-green-500/10 hover:text-green-500 rounded-full transition cursor-pointer"><Share size={18} /></div>
                    </div>

                    {/* Área de Respostas */}
                    {comentandoEm === post.id && (
                      <div className="mt-4 bg-[#16181c] p-4 rounded-2xl border border-gray-800 shadow-xl">
                        <div className="flex gap-2 mb-4">
                          <input 
                            value={novoComentario} 
                            onChange={e => setNovoComentario(e.target.value)} 
                            className="flex-1 bg-transparent border-b border-gray-700 outline-none text-sm py-1 focus:border-sky-500 transition" 
                            placeholder="Postar sua resposta" 
                          />
                          <button onClick={() => enviarComentario(post.id)} className="bg-sky-500 px-4 py-1 rounded-full text-white text-xs font-bold hover:bg-sky-600 transition">Responder</button>
                        </div>
                        <div className="space-y-4 max-h-60 overflow-y-auto pr-2">
                          {post.comentarios?.map((c: any) => (
                            <div key={c.id} className="text-[13px] flex gap-2">
                              <div className="w-6 h-6 bg-gray-700 rounded-full flex items-center justify-center text-[10px] font-bold uppercase shrink-0">{c.usuarios?.username?.[0]}</div>
                              <div className="flex-1">
                                <span className="font-bold">@{c.usuarios?.username}</span>
                                <p className="text-gray-300 mt-0.5">{c.conteudo}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  )
}
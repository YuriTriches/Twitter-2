const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

const app = express(); // <--- Faltava essa linha que define o 'app'!
app.use(cors());
app.use(express.json());

// Seus dados do Supabase que você mandou
const SUPABASE_URL = 'https://bqgnoafpjdlzxedqupsr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_oUAHskL6NFf5qePTP8ofiA_o-oKh-1H';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 1. REGISTRAR (Adaptado para sua tabela 'usuarios')
app.post('/registrar', async (req, res) => {
  const { nome, senha } = req.body;
  
  const { data, error } = await supabase
    .from('usuarios')
    .insert([{ 
        username: nome, 
        senha: senha, 
        full_name: nome 
    }])
    .select()
    .single();

  if (error) {
    console.error(error);
    return res.status(400).json({ error: "Erro ao registrar ou usuário já existe" });
  }
  res.json(data);
});

// 2. LOGIN
app.post('/login', async (req, res) => {
  const { nome, senha } = req.body;
  
  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('username', nome)
    .eq('senha', senha)
    .single();

  if (error || !data) {
    return res.status(401).json({ error: "Usuário ou senha incorretos" });
  }
  res.json(data);
});

// Porta do Servidor
app.listen(3001, () => {
  console.log("--------------------------------");
  console.log("🚀 BACKEND DO TWITTER RODANDO");
  console.log("📡 URL: http://localhost:3001");
  console.log("--------------------------------");
});
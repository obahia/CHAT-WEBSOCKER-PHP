const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const server = new WebSocket.Server({ port: 8080 });
const MESSAGES_DIR = path.join(__dirname, 'chat_logs');
const MESSAGES_FILE = path.join(MESSAGES_DIR, 'chat_history.txt');

console.log(`Servidor WebSocket rodando na porta ${server.options.port}`);

// Criar diretório de logs se não existir
if (!fs.existsSync(MESSAGES_DIR)) {
  fs.mkdirSync(MESSAGES_DIR);
}

const salas = new Map(); // sala => Set de sockets
const usuarios = new Map(); // socket => { nome, sala }

/**
 * Salva uma mensagem no arquivo de histórico (sem incluir o autor separadamente)
 */
function salvarMensagem(mensagem) {
  const timestamp = new Date().toISOString();
  const linha = `${timestamp}|${mensagem.sala}|${mensagem.texto}\n`;
  
  fs.appendFile(MESSAGES_FILE, linha, (err) => {
    if (err) console.error('Erro ao salvar mensagem:', err);
  });
}

/**
 * Carrega o histórico de mensagens de uma sala específica
 */
function carregarHistoricoSala(sala, limite = 50) {
  try {
    if (!fs.existsSync(MESSAGES_FILE)) return [];
    
    const data = fs.readFileSync(MESSAGES_FILE, 'utf8');
    return data.split('\n')
      .filter(line => line.trim())
      .map(line => {
        const [timestamp, salaMsg, texto] = line.split('|');
        return { timestamp, sala: salaMsg, texto };
      })
      .filter(msg => msg.sala === sala)
      .slice(-limite);
  } catch (err) {
    console.error('Erro ao carregar histórico:', err);
    return [];
  }
}

/**
 * Envia dados para todos os clientes em uma sala
 */
function enviarParaSala(sala, data, excluirSocket = null) {
  if (!salas.has(sala)) return;
  
  const mensagem = JSON.stringify(data);
  salas.get(sala).forEach(cliente => {
    if (cliente !== excluirSocket && cliente.readyState === WebSocket.OPEN) {
      cliente.send(mensagem);
    }
  });
}

/**
 * Atualiza a lista de usuários e salas para todos os clientes
 */
function atualizarUsuariosESalas() {
  const listaSalas = Array.from(salas.keys());
  
  usuarios.forEach((userData, socket) => {
    if (socket.readyState !== WebSocket.OPEN) return;
    
    const usuariosSala = Array.from(salas.get(userData.sala))
      .filter(s => usuarios.has(s))
      .map(s => usuarios.get(s).nome);
    
    socket.send(JSON.stringify({ 
      tipo: "usuarios", 
      usuarios: usuariosSala,
      salas: listaSalas,
      salaAtual: userData.sala
    }));
  });
}

/**
 * Remove um usuário de uma sala
 */
function removerUsuario(socket) {
  if (!usuarios.has(socket)) return;
  
  const { nome, sala } = usuarios.get(socket);
  
  if (salas.has(sala)) {
    salas.get(sala).delete(socket);
    if (salas.get(sala).size === 0) salas.delete(sala);
  }
  
  usuarios.delete(socket);
  console.log(`${nome || 'Usuário'} saiu da sala ${sala}`);
  
  if (sala) {
    enviarParaSala(sala, { 
      tipo: "mensagem", 
      texto: `${nome || 'Usuário'} saiu da sala.`,
      timestamp: new Date().toISOString()
    });
  }
  
  atualizarUsuariosESalas();
}

server.on('connection', socket => {
  console.log("Novo cliente conectado");
  
  // Envia lista de salas ao conectar
  socket.send(JSON.stringify({ 
    tipo: "salas", 
    salas: Array.from(salas.keys()) 
  }));

  socket.on('message', data => {
    try {
      const msg = JSON.parse(data);
      
      switch (msg.tipo) {
        case "entrar":
          if (!msg.nome || !msg.sala) return;
          
          if (usuarios.has(socket)) removerUsuario(socket);
          
          if (!salas.has(msg.sala)) salas.set(msg.sala, new Set());
          
          salas.get(msg.sala).add(socket);
          usuarios.set(socket, { nome: msg.nome, sala: msg.sala });
          
          console.log(`${msg.nome} entrou na sala ${msg.sala}`);
          
          // Envia histórico
          socket.send(JSON.stringify({
            tipo: "history",
            mensagens: carregarHistoricoSala(msg.sala)
          }));
          
          enviarParaSala(msg.sala, { 
            tipo: "mensagem", 
            texto: `${msg.nome} entrou na sala.`,
            timestamp: new Date().toISOString()
          }, socket);
          
          atualizarUsuariosESalas();
          break;
          
        case "mensagem":
          const user = usuarios.get(socket);
          if (user) {
            const mensagemCompleta = {
              tipo: "mensagem",
              texto: msg.texto,
              timestamp: new Date().toISOString()
            };
            
            salvarMensagem({
              sala: user.sala,
              texto: msg.texto
            });
            
            enviarParaSala(user.sala, mensagemCompleta, socket);
          }
          break;
          
        case "sair":
          removerUsuario(socket);
          break;
          
        case "get_history":
          if (msg.sala) {
            socket.send(JSON.stringify({
              tipo: "history",
              mensagens: carregarHistoricoSala(msg.sala, msg.limite)
            }));
          }
          break;
      }
    } catch (e) {
      console.error("Erro ao processar mensagem:", e);
    }
  });

  socket.on('close', () => removerUsuario(socket));
  socket.on('error', (error) => {
    console.error('Erro no socket:', error);
    removerUsuario(socket);
  });
});

// Rotação diária de arquivos de log
setInterval(() => {
  const date = new Date();
  if (date.getHours() === 0 && date.getMinutes() === 0) {
    const newFileName = path.join(MESSAGES_DIR, `chat_history_${date.toISOString().split('T')[0]}.txt`);
    if (fs.existsSync(MESSAGES_FILE)) {
      fs.renameSync(MESSAGES_FILE, newFileName);
    }
  }
}, 60000);

// Limpeza de salas vazias
setInterval(() => {
  salas.forEach((clientes, sala) => {
    if (clientes.size === 0) {
      salas.delete(sala);
      console.log(`Sala ${sala} removida por estar vazia`);
    }
  });
}, 60000);
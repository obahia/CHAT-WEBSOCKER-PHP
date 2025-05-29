const WebSocket = require('ws');
const server = new WebSocket.Server({ port: 8080 });

console.log(`Servidor WebSocket rodando na porta ${server.options.port}`);

const salas = new Map(); // sala => Set de sockets
const usuarios = new Map(); // socket => { nome, sala }

/**
 * Envia dados para todos os clientes em uma sala, exceto opcionalmente um socket específico
 * @param {string} sala - Nome da sala
 * @param {object} data - Dados a serem enviados
 * @param {WebSocket} [excluirSocket=null] - Socket a ser excluído do envio
 */
function enviarParaSala(sala, data, excluirSocket = null) {
  if (!salas.has(sala)) return;
  
  const clientesSala = salas.get(sala);
  const mensagem = JSON.stringify(data);
  
  clientesSala.forEach(cliente => {
    if (cliente !== excluirSocket && cliente.readyState === WebSocket.OPEN) {
      try {
        cliente.send(mensagem);
      } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
      }
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
    
    const sala = userData.sala;
    const usuariosSala = Array.from(salas.get(sala))
      .filter(s => usuarios.has(s))
      .map(s => usuarios.get(s).nome);
    
    try {
      socket.send(JSON.stringify({ 
        tipo: "usuarios", 
        usuarios: usuariosSala 
      }));
      
      socket.send(JSON.stringify({ 
        tipo: "salas", 
        salas: listaSalas 
      }));
      
      socket.send(JSON.stringify({ 
        tipo: "salaAtual", 
        nome: sala 
      }));
    } catch (error) {
      console.error('Erro ao atualizar informações:', error);
    }
  });
}

/**
 * Remove um usuário de uma sala
 * @param {WebSocket} socket - Socket do usuário
 */
function removerUsuario(socket) {
  if (!usuarios.has(socket)) return;
  
  const { nome, sala } = usuarios.get(socket);
  
  if (salas.has(sala)) {
    salas.get(sala).delete(socket);
    
    // Remove a sala se estiver vazia
    if (salas.get(sala).size === 0) {
      salas.delete(sala);
    }
  }
  
  usuarios.delete(socket);
  console.log(`${nome || 'Usuário desconhecido'} saiu da sala ${sala}`);
  
  if (nome && sala) {
    enviarParaSala(sala, { 
      tipo: "mensagem", 
      texto: `${nome} saiu da sala.` 
    }, socket);
  }
  
  atualizarUsuariosESalas();
}

server.on('connection', socket => {
  console.log("Novo cliente conectado");
  
  // Envia a lista de salas disponíveis ao conectar
  try {
    socket.send(JSON.stringify({ 
      tipo: "salas", 
      salas: Array.from(salas.keys()) 
    }));
  } catch (error) {
    console.error('Erro ao enviar lista de salas:', error);
  }

  socket.on('message', data => {
    let msg;
    
    try {
      msg = JSON.parse(data);
      
      if (!msg.tipo) {
        throw new Error('Mensagem sem tipo');
      }
    } catch (e) {
      console.error("Mensagem inválida:", data, e.message);
      return;
    }
    
    switch (msg.tipo) {
      case "entrar":
        if (!msg.nome || !msg.sala) {
          console.error('Dados incompletos para entrar na sala');
          return;
        }
        
        // Remove o usuário de qualquer sala anterior
        if (usuarios.has(socket)) {
          removerUsuario(socket);
        }
        
        // Cria a sala se não existir
        if (!salas.has(msg.sala)) {
          salas.set(msg.sala, new Set());
        }
        
        // Adiciona o usuário à sala
        salas.get(msg.sala).add(socket);
        usuarios.set(socket, { nome: msg.nome, sala: msg.sala });
        
        console.log(`${msg.nome} entrou na sala ${msg.sala}`);
        
        enviarParaSala(msg.sala, { 
          tipo: "mensagem", 
          texto: `${msg.nome} entrou na sala.` 
        }, socket);
        
        atualizarUsuariosESalas();
        break;
        
      case "mensagem":
        const user = usuarios.get(socket);
        if (user) {
          enviarParaSala(user.sala, { 
            tipo: "mensagem", 
            texto: msg.texto,
            autor: user.nome,
            timestamp: new Date().toISOString()
          }, socket);
        }
        break;
        
      case "sair":
        removerUsuario(socket);
        break;
        
      case "pedir_salas":
        try {
          socket.send(JSON.stringify({ 
            tipo: 'salas', 
            salas: Array.from(salas.keys()) 
          }));
        } catch (error) {
          console.error('Erro ao enviar salas:', error);
        }
        break;
        
      default:
        console.warn('Tipo de mensagem desconhecido:', msg.tipo);
    }
  });

  socket.on('close', () => {
    removerUsuario(socket);
  });
  
  socket.on('error', (error) => {
    console.error('Erro no socket:', error);
    removerUsuario(socket);
  });
});

// Limpeza periódica de salas vazias (opcional)
setInterval(() => {
  salas.forEach((clientes, sala) => {
    if (clientes.size === 0) {
      salas.delete(sala);
      console.log(`Sala ${sala} removida por estar vazia`);
    }
  });
}, 60000); // A cada minuto
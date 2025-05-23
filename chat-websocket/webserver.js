const WebSocket = require('ws');
const server = new WebSocket.Server({ port: 8080 });

console.log("Servidor rodando na porta 8080");

const salas = new Map(); // sala => Set de sockets
const usuarios = new Map(); // socket => { nome, sala }

function enviarParaSala(sala, data, excluirSocket = null) {
  if (!salas.has(sala)) return;
  for (const cliente of salas.get(sala)) {
    if (cliente !== excluirSocket && cliente.readyState === WebSocket.OPEN) {
      cliente.send(JSON.stringify(data));
    }
  }
}

function atualizarUsuariosESalas() {
  const listaSalas = [...salas.keys()];
  for (const [socket, { sala }] of usuarios) {
    const nomes = [...salas.get(sala)]
      .filter(s => usuarios.get(s))
      .map(s => usuarios.get(s).nome);

    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ tipo: "usuarios", usuarios: nomes }));
      socket.send(JSON.stringify({ tipo: "salas", salas: listaSalas }));
      socket.send(JSON.stringify({ tipo: "salaAtual", nome: sala }));
    }
  }
}

server.on('connection', socket => {
  console.log("Novo cliente conectado");

  socket.on('message', data => {
    let msg;
    try {
      msg = JSON.parse(data);
    } catch (e) {
      console.error("Mensagem inválida:", data);
      return;
    }

    if (msg.tipo === "entrar") {
      const { nome, sala } = msg;
      usuarios.set(socket, { nome, sala });

      if (!salas.has(sala)) salas.set(sala, new Set());
      salas.get(sala).add(socket);

      console.log(`${nome} entrou na sala ${sala}`);

      enviarParaSala(sala, { tipo: "mensagem", texto: `${nome} entrou na sala.` }, socket);
      atualizarUsuariosESalas();
    }

    else if (msg.tipo === "mensagem") {
      const user = usuarios.get(socket);
      if (user) {
        // Envia pra todo mundo, exceto quem enviou a mensagem
        enviarParaSala(user.sala, { tipo: "mensagem", texto: msg.texto }, socket);
      }
    }

    else if (msg.tipo === "sair") {
      const user = usuarios.get(socket);
      if (user) {
        const { nome, sala } = user;
        salas.get(sala)?.delete(socket);
        usuarios.delete(socket);
        console.log(`${nome} saiu da sala ${sala}`);
        enviarParaSala(sala, { tipo: "mensagem", texto: `${nome} saiu da sala.` }, socket);
        atualizarUsuariosESalas();
      }
    }
  });

  socket.on('close', () => {
    const user = usuarios.get(socket);
    if (user) {
      const { nome, sala } = user;
      salas.get(sala)?.delete(socket);
      usuarios.delete(socket);
      console.log(`${nome} saiu (desconectado) da sala ${sala}`);
      enviarParaSala(sala, { tipo: "mensagem", texto: `${nome} saiu da sala.` }, socket);
      atualizarUsuariosESalas();
    }
  });
});

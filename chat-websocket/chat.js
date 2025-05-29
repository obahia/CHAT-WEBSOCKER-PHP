const loginArea = document.getElementById("loginArea");
const app = document.getElementById("app");
const nomeInput = document.getElementById("InputUsername");
const inputNovaSala = document.getElementById("inputNovaSala");
const listaSalas = document.getElementById("listaSalas");
const btnEntrar = document.getElementById("btnEntrar");
const btnSair = document.getElementById("btnSair");
const nomeSala = document.getElementById("nomeSala");
const chat = document.getElementById("chat");
const msgInput = document.getElementById("msg");
const btnEnviar = document.getElementById("btnEnviar");

let socket;
let nome = "";
let sala = "";
let salaSelecionada = "";
let socketSalas;



function conectaSocketSalas() {
  socketSalas = new WebSocket("ws://localhost:8080");

  socketSalas.onopen = () => {
    socketSalas.send(JSON.stringify({ tipo: "pede_salas" }));
  };

  socketSalas.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.tipo === "salas") {
      atualizarListaSalas(data.salas);
    }
  };

  socketSalas.onclose = () => {
    // tenta reconectar após 5 segundos se cair
    setTimeout(conectaSocketSalas, 5000);
  };
}

conectaSocketSalas();

function atualizarListaSalas(salas) {
  listaSalas.innerHTML = "";
  salas.forEach(salaNome => {
    const li = document.createElement("li");
    li.textContent = salaNome;
    li.style.cursor = "pointer";
    li.addEventListener("click", () => {
      document.querySelectorAll("#listaSalas li").forEach(el => el.classList.remove("selected"));
      li.classList.add("selected");
      salaSelecionada = salaNome;
      inputNovaSala.value = "";
    });
    listaSalas.appendChild(li);
  });
}


btnEntrar.addEventListener("click", () => {
  nome = nomeInput.value.trim();
  const novaSala = inputNovaSala.value.trim();
  sala = novaSala || salaSelecionada;

  if (!nome || !sala) {
    alert("Preencha seu nome e selecione ou crie uma sala!");
    return;
  }

  entrarNoChat(nome, sala);
});

btnSair.addEventListener("click", () => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ tipo: "sair" }));
    socket.close();
  }

  socket = null;
  nome = "";
  sala = "";
  salaSelecionada = "";

  app.style.display = "none";
  loginArea.style.display = "block";
  chat.innerHTML = "";
  nomeSala.textContent = "Nenhuma";
  nomeInput.value = "";
  inputNovaSala.value = "";
  document.querySelectorAll("#listaSalas li").forEach(el => el.classList.remove("selected"));
});

btnEnviar.addEventListener("click", enviarMensagem);
msgInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") enviarMensagem();
});

function entrarNoChat(nomeUser, salaUser) {
  loginArea.style.display = "none";
  app.style.display = "flex";
  nomeSala.textContent = salaUser;
  chat.innerHTML = "";

  socket = new WebSocket("ws://localhost:8080");

  socket.onopen = () => {
    socket.send(JSON.stringify({ tipo: "entrar", nome: nomeUser, sala: salaUser }));
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.tipo === "mensagem") {
      adicionaMensagem(data.texto, data.autor === nome);
    } else if (data.tipo === "salas") {
      atualizarListaSalas(data.salas);
    }
  };

  socket.onclose = () => {
    chat.innerHTML = "";
  };
}

function enviarMensagem() {
  const texto = msgInput.value.trim();
  if (!texto || !socket || socket.readyState !== WebSocket.OPEN) return;

  const mensagem = `${nome}: ${texto}`;
  socket.send(JSON.stringify({ tipo: "mensagem", texto: mensagem, autor: nome }));
  adicionaMensagem(mensagem, true);
  msgInput.value = "";
  msgInput.focus();
}

function adicionaMensagem(texto, isOwn) {
  const li = document.createElement("li");
  li.textContent = texto;
  if (isOwn) li.classList.add("own");
  chat.appendChild(li);
  chat.scrollTop = chat.scrollHeight;
}
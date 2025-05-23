<?php
set_time_limit(0);
$host = "127.0.0.1"; // Endereço do servidor
$port = 12345; // Porta para conexão
// Criando o socket do servidor
$server = socket_create(AF_INET, SOCK_STREAM, SOL_TCP);
socket_bind($server, $host, $port);
socket_listen($server);
$clientes = [$server];
echo "Servidor ligado em $host:$port\n";
while (true) {
    $read = $clientes;
    socket_select($read, $write, $except, 0);
    if (in_array($server, $read)) {
        $novoCliente = socket_accept($server);
        $clientes[] = $novoCliente;
        socket_getpeername($novoCliente, $addr);
        echo "Novo cliente ligado: $addr\n";
        unset($read[array_search($server, $read)]);
    }
    foreach ($read as $cliente) {
        $mensagem = socket_read($cliente, 1024, PHP_NORMAL_READ);
        if ($mensagem === false) {
            socket_close($cliente);
            unset($clientes[array_search($cliente, $clientes)]);
            continue;
        }
        $mensagem = trim($mensagem);
        if ($mensagem) {
            echo "Mensagem recebida: $mensagem\n";
            foreach ($clientes as $c) {
                if ($c != $server && $c != $cliente) {
                    socket_write($c, $mensagem . "\n");
                }
            }
        }
    }
}
socket_close(socket: $server);
?>
<?php
$host = "127.0.0.1";
$port = 12345;

$socket = stream_socket_client("tcp://$host:$port", $errno, $errstr, 30);
if (!$socket) {
    echo "Erro ao conectar: $errstr ($errno)\n";
    exit(1);
}

echo "Ligado ao chat! Digite uma mensagem:\n";

stream_set_blocking($socket, false);
stream_set_blocking(STDIN, false);

while (true) {
    $read = [$socket, STDIN];
    $write = null;
    $except = null;

    if (stream_select($read, $write, $except, null)) {
        foreach ($read as $r) {
            if ($r === $socket) {
                $mensagem = fread($socket, 1024);
                if ($mensagem === false || $mensagem === "") {
                    echo "\nConexão encerrada pelo servidor.\n";
                    exit;
                }
                echo "\nMensagem recebida: " . trim($mensagem) . "\n";
                echo "Digite uma mensagem:\n";
            }

            if ($r === STDIN) {
                $mensagem = trim(fgets(STDIN));
                if ($mensagem) {
                    fwrite($socket, $mensagem . "\n");
                }
            }
        }
    }
}
fclose($socket);

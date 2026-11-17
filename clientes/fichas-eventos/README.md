# LT Fichas para Eventos

Aplicativo isolado em `clientes/fichas-eventos/`. Abrir com internet antes do evento e preparar cada aparelho. O caixa grava vendas em IndexedDB antes de solicitar impressão. A sincronização tem fila persistente, reenvio idempotente e tentativa em segundo plano, sem aguardar rede no recebimento.

## Uso
1. Criar um evento, setores e produtos ou experimentar o evento de teste.
2. Em Cadastros → Conexão, copiar o código privado para outros aparelhos ainda sem eventos. Sincronizar todos com internet ANTES da festa.
3. Cadastros → Impressora: configurar ESC/POS Network/WiFi no Android, IP local da térmica, papel 80 mm e guilhotina a cada página.
4. Imprimir DUAS fichas de teste. Exigir corte entre elas. O navegador não envia comandos ESC/POS crus nem confirma a saída física.
5. Selecionar itens, escolher dinheiro/Pix/débito/crédito, confirmar recebimento e solicitar impressão. Pix/cartão exigem conferência pelo operador; não há integração com adquirente.
6. Na rede local sem internet, continuar vendendo. Os totais de outros caixas serão juntados quando CADA aparelho acessar internet.
7. Baixar backups antes/depois de eventos. Não usar modo anônimo nem apagar armazenamento com pendências.

## Impressão
Uma página fixa de 80 × 55 mm por unidade. O serviço precisa respeitar a paginação e estar configurado para cortar entre páginas. Sistema Android: app link documentado do ESC/POS Network/WiFi Print Service; em outros sistemas, diálogo de impressão (requer serviço/impressora compatível). Cancelar impressão NÃO desfaz a venda. Histórico permite 2ª via com mesmo código. Reimpressão não registra receita. Verificar configuração com equipamento real; corte físico e interface em navegador real ainda não foram verificados neste ambiente.

## Sincronização e isolamento
Função `lt-eventos-sync`, autenticação própria por ID aleatório e segredo de 256 bits; segredo gerado no aparelho, hash SHA-256 no servidor. Código de conexão e backup são privados e concedem acesso à organização. Tabelas com RLS e sem acesso direto de anon/authenticated; função usa service role apenas no servidor. Comparação de revisão por evento previne perda em envios simultâneos. Cancelamento prevalece sobre reenvio de venda paga. Vendas de eventos distintos não compartilham produtos nem relatórios.
Não há controle de papéis por operador nesta versão de teste: quem possui o código tem acesso aos eventos da organização.
O compartilhamento de cadastros exige internet inicial. Não há sincronização entre caixas por LAN sem internet.

## Validação
Arquivo `core-tests.js` executa asserções de cálculos, troco, idempotência, cancelamento, isolamento e combinação de dois aparelhos. Executar com `window.FichasCore` em ambiente JavaScript. Arquivos JS compilados para conferir sintaxe. Confirmar em celular/tablet: reabrir offline na rede da impressora, vender com nuvem indisponível, religar internet e comparar fechamentos, testar impressão/corte.

## Implantação
Arquivos estáticos servidos pelo Vercel existente. Service worker exclusivo do diretório. Cache atualizado alterando a versão em `sw.js`. Backend em `supabase/functions/lt-eventos-sync/`: aplicar schema.sql e implantar com JWT desligado, pois há autenticação própria no corpo. Nunca incluir service-role no frontend.


## Conexão com código curto
No aparelho principal: Cadastros → Conexão → Gerar código curto. No aparelho novo, ainda sem eventos: Conectar aparelho → digitar oito caracteres (ABCD-2345). A conexão inicial exige internet; os eventos continuam vendendo offline depois de baixados.

O convite dura dez minutos, pode ser usado uma vez e é substituído ao gerar outro. Os aparelhos já conectados continuam conectados após o convite expirar. O convite conecta aos eventos da mesma organização, preservando o isolamento dos dados de cada evento existente.

O código tem 40 bits aleatórios, com alfabeto de 32 símbolos sem I/O/0/1. Só o hash do convite é armazenado; as credenciais temporárias são cifradas com AES-GCM no servidor. O resgate remove a linha atomicamente. Há limite de 15 tentativas por minuto por identificador de endereço e acesso às tabelas/RPC somente pelo serviço. O cliente público nunca recebe a chave do servidor.

Aplicar pairing-schema.sql uma vez antes de implantar a função atualizada. Testes do handler: node pair-tests.mjs (Node 24+, banco REST simulado e criptografia real). Os testes SQL de expiração, uso único e limite de tentativas foram executados na base real em uma transação revertida.

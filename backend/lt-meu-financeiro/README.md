# Cartões e faturas — Meu Financeiro

Apenas o aplicativo financeiro utiliza estas regras. A autenticação existente associa cada pessoa a um espaço financeiro no servidor; todos os cartões, faturas e contas pertencem ao estado desse espaço.

- Os campos `cards` e `invoices` são opcionais em dados antigos e são adicionados sem alterar os lançamentos existentes.
- A compra no crédito gera um lançamento pendente associado a `cardId` e `invoiceId`, sem conta bancária e sem impacto no saldo disponível.
- Fechamento e vencimento usam dias cadastrados pelo usuário. Dias inexistentes são ajustados ao último dia do mês. Vencimento igual ou anterior ao fechamento pertence ao mês seguinte.
- Datas de faturas já existentes são preservadas quando o cadastro do cartão é alterado.
- Fechar uma fatura requer confirmação do total atual e nenhuma diferença com o total informado do banco. Nenhum ajuste fictício é criado.
- Pagamento exige fatura fechada, total confirmado, conta pertencente ao mesmo espaço e data válida. As compras são baixadas juntas na mesma atualização; nenhuma despesa extra de pagamento é criada.
- A versão da fatura muda quando suas compras mudam. Conferências e pagamentos antigos são rejeitados. A gravação no banco mantém a comparação atômica da revisão do espaço.
- Faturas fechadas/pagas bloqueiam alteração nas compras. O usuário pode reabrir uma fatura ainda não paga ou desfazer o registro do pagamento. Nada disso altera um pagamento real no banco.
- Fechamento de uma fatura conferida em zero não cria débito nem solicita uma conta pagadora.
- Lembretes usam a data de São Paulo e aparecem na conversa ao abrir o aplicativo. Não há envio de push em segundo plano nesta versão. “Ainda não” adia a pergunta para o dia seguinte, mantendo a fatura pendente.

## Validação

Da raiz do repositório, com Node moderno:

    node --experimental-default-type=module --test backend/lt-meu-financeiro/tests/*.test.js
    node --experimental-default-type=module backend/lt-meu-financeiro/tests/ui-smoke.js

O teste da interface usa um DOM simulado e API em memória. Não acessa nem modifica dados reais. O fluxo também foi verificado na função publicada usando um espaço e um login técnicos temporários, removidos após a verificação.

## Orçamentos opcionais

O recurso começa desativado. Na conversa ou em Contas, abra Orçamentos, ative e defina limites para o mês selecionado. Combustível considera a descrição do lançamento; outras metas usam sua categoria. Compras no crédito contam pela data da compra, e outras despesas quando pagas. Pagamento de fatura não duplica consumo.

Ao ultrapassar um limite, o servidor registra um aviso com o limite e o gasto na ocasião. Na conversa aparece o aviso; em Orçamentos pode salvar um motivo ou escolher não justificar. O histórico permanece ao desativar, editar limites ou corrigir gastos. Não há notificação externa: avisos são exibidos no aplicativo ao salvar, atualizar ou abrir a conversa. Limites são mensais e não são copiados automaticamente ao mês seguinte.

Dados ficam no JSON do próprio espaço, com a autenticação e o controle de concorrência existentes. Não há nova tabela nem modificação de outros sistemas.

## Usuários e permissões

Luciano é o administrador protegido. Os acessos existentes e suas senhas são preservados. Novos usuários são membros do mesmo espaço financeiro, com consulta como padrão e demais permissões desativadas. Não há convite nem cadastro público.

A consulta permite ver todo o financeiro compartilhado; a conversa permanece particular por usuário. As permissões de lançamentos, faturas, contas, cartões e orçamentos são verificadas no servidor a cada chamada. Sem consulta, o estado financeiro retorna vazio e as rotas de conversa são bloqueadas. Desativar ou trocar a senha revoga os tokens do usuário. O proprietário não pode ser desativado ou alterado pela tela; membros não gerenciam usuários.

Aplicar users-schema.sql antes de publicar a função atualizada. As tabelas internas seguem sem acesso para anon/authenticated e protegidas por RLS. Apenas a função com autenticação própria acessa os dados pelo serviço interno.

O comando de fechar fatura apresenta compras e total já lançados. Total diferente mantém a conferência de divergências e fechamento exige confirmação. A conta do pagamento pode ser alterada na revisão. Baixas comuns aceitam a conta selecionada atomicamente no mesmo controle de revisão.

Testes de API com importação de TypeScript usam Node 24.

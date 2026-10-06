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

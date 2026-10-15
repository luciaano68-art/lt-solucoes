# TESSARO PDV PROTOTIPO — LT Soluções

Ambiente separado do Tessaro Gestão oficial e dos outros aplicativos.

A base de teste Consumer de 15/10/2026 fica em `tessaro_pdv_prototype_state`, protegida por RLS e por uma chave aleatória de acesso de 256 bits. O arquivo privado de acesso é entregue ao proprietário e não deve ser publicado neste repositório. O navegador recebe a chave pelo fragmento do endereço, remove o fragmento e usa o cabeçalho `x-tessaro-prototype-key`. Apenas o hash SHA-256 da chave fica na tabela.

O cliente pode ler a sua base e atualizar a coluna `data`. Não pode inserir, apagar, truncar, alterar a chave nem a versão. A gravação compara a versão remota; se outro aparelho alterou a base, mantém a cópia local e avisa em vez de sobrescrever silenciosamente.

Produtos mantêm preços, custos, códigos, categorias e status do Consumer. A base contém os complementos, mas os arquivos recebidos não descrevem os vínculos com cada produto. Os saldos de fiados são de abertura; recebíveis não são lançados novamente como débitos de clientes. Contas importadas preservam o status do Consumer, sem inventar conciliações bancárias ou saldo de caixa.

Dados financeiros e de clientes não devem ser incluídos em arquivos públicos. A tabela `platform_state` anterior não recebe esta importação.

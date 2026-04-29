# Migracao para PHP + MySQL (Guia rapido)

Este projeto foi migrado de dados mockados para API real em PHP + MySQL, mantendo o mesmo layout visual.

## 1) Estrutura criada

- `config/database.php`: conexao PDO.
- `config/http.php`: resposta JSON e leitura de body.
- `config/helpers.php`: funcoes utilitarias.
- `api/clientes.php`: CRUD de clientes.
- `api/produtos.php`: CRUD de produtos.
- `api/vendas.php`: nova venda + edicao de pagamento + baixa de estoque.
- `api/dashboard.php`: KPIs e pedidos recentes.
- `database/schema.sql`: tabelas, indices e chaves.
- `database/seed.sql`: dados iniciais para teste.
- `pages/*.php`: atalhos de rota para abrir cada aba.
- `assets/css/main.css` e `assets/js/main.js`: ponte para manter organizacao sem quebrar o front.

## 2) Banco de dados

Copie `config/database.example.php` para `config/database.php` e configure os dados do seu banco:

- Host: seu host MySQL
- Porta: `3306`
- Usuario: seu usuario MySQL
- Senha: sua senha MySQL
- Banco: nome real do banco criado no painel.

## 3) Executar SQL

No phpMyAdmin do InfinityFree:

1. Execute `database/schema.sql`.
2. (Opcional) Execute `database/seed.sql` para popular dados de teste.

## 4) Frontend

O layout foi preservado.

- `index.html` continua com o mesmo HTML/CSS.
- Agora o JS usa `fetch` para consumir as APIs em `/api`.

## 5) Regras implementadas

- Clientes:
  - cadastro, listagem, edicao
  - validacao de duplicidade (telefone/email)
  - filtros por nome/telefone/status
- Produtos:
  - cadastro, listagem, edicao
  - controle de estoque
  - status ativo/inativo
- Vendas:
  - cria venda + itens
  - atualiza estoque ao salvar
  - nao permite data retroativa
  - credito rotativo exige data futura
  - pagamento imediato atualiza status como pago
  - tela de gestao edita apenas forma/status de pagamento
- Historico:
  - lista sem exibir ID no card
  - ID aparece no modal/cupom de detalhe

## 6) Observacao importante

Neste ambiente, o comando `php` nao esta instalado no terminal, entao a validacao automatica de sintaxe (`php -l`) nao pode ser executada aqui.
Quando voce rodar localmente com PHP instalado, rode:

```powershell
php -l config\database.php
php -l api\clientes.php
php -l api\produtos.php
php -l api\vendas.php
php -l api\dashboard.php
```

# Sistema de Clientes e Atendimentos

Projeto desenvolvido por Lucas Soares como parte da minha transicao para a area de tecnologia, unindo minha experiencia com sistemas, dados operacionais, processos empresariais e minha formacao em Analise e Desenvolvimento de Sistemas.

A ideia foi criar um sistema simples, mas com cara de rotina real: cadastro de clientes, registro de atendimentos, indicadores e boas praticas basicas de seguranca.

## Tecnologias

- JavaScript
- Node.js
- HTML
- CSS
- Persistencia em JSON local

## Funcionalidades

- Login com sessao
- Senha protegida com hash PBKDF2
- Cadastro, edicao e exclusao de clientes
- Registro de atendimentos
- Filtros e indicadores
- Dashboard com status dos atendimentos
- Validacao de campos obrigatorios
- Rotas protegidas

## Contexto do projeto

Durante minhas experiencias profissionais, tive contato com sistemas ERP, planilhas, atendimento, controle de informacoes e analise de dados da rotina. Esse projeto foi criado para praticar desenvolvimento full stack usando um problema comum em empresas: organizar clientes, acompanhar atendimentos e visualizar indicadores.

## O que aprendi

- Estruturar um projeto web com Node.js
- Criar rotas de API para login, clientes, atendimentos e dashboard
- Trabalhar com dados em JSON simulando uma base de dados
- Criar telas com HTML, CSS e JavaScript
- Aplicar validacao de dados antes de salvar informacoes
- Pensar em seguranca basica, como hash de senha e sessao protegida
- Organizar um README para explicar o projeto no GitHub

## Como rodar

```bash
node server.js
```

Acesse:

```text
http://localhost:3000
```

Login demo:

```text
E-mail: admin@demo.com
Senha: admin123
```

## Proximas melhorias

- Migrar persistencia de JSON para PostgreSQL
- Adicionar campo de responsavel pelo atendimento
- Criar filtro por prioridade e status
- Adicionar testes automatizados
- Criar versao com React
- Adicionar niveis de permissao
- Publicar deploy

## Autor

Lucas Soares

- LinkedIn: https://www.linkedin.com/in/olucassoares/
- GitHub: https://github.com/olucassoares

## Texto para LinkedIn

Desenvolvi um sistema full stack para controle de clientes e atendimentos, com login, CRUD, dashboard e boas praticas basicas de seguranca. O projeto foi criado com JavaScript e Node.js, simulando uma rotina empresarial com cadastro de clientes, acompanhamento de atendimentos e indicadores operacionais.

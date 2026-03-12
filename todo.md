# ICR Secretaria - TODO

## Configuração e Base
- [x] Inicializar projeto React com tRPC + DB
- [x] Analisar design Figma e API
- [x] Upload do logo ICR para CDN
- [x] Configurar tema dark com cores do design Figma
- [x] Implementar layout base com sidebar (ICRLayout customizado)
- [x] Configurar cliente HTTP para a API ICR (useICRApi + ICRAuthContext)

## Páginas
- [x] Login (autenticação com a API ICR)
- [x] Início (Dashboard com estatísticas)
- [x] Comissões Federadas (CRUD)
- [x] Igrejas (CRUD)
- [x] Células (CRUD)
- [x] Famílias (CRUD)
- [x] Membros (CRUD)
- [x] Pastores e Presbíteros (CRUD)
- [x] Datas Pastores (aniversários/datas especiais por mês)
- [x] Repasses (tabela estilo Excel com filtros por mês)
- [ ] Configurações (placeholder - em breve)
- [ ] Perfil (placeholder - em breve)

## Funcionalidades Especiais
- [x] Tabela de repasses estilo planilha Excel com cores (verde/amarelo/vermelho)
- [x] Filtro por mês/referência na tabela de repasses
- [x] Indicadores coloridos de status de pagamento
- [x] Navegação por abas (meses) na tabela de repasses
- [x] Resumo de totais (total pago, igrejas em dia, pendentes)

## Testes
- [x] Testes unitários para autenticação ICR e lógica de repasses (9 testes passando)

## Modularização da API (Docker)
- [x] Criar variável de ambiente ICR_API_URL para configurar o endpoint da API
- [x] Configurar proxy reverso no servidor Express (/api/icr/* → ICR_API_URL)
- [x] Atualizar ICRAuthContext para usar o proxy local
- [x] Atualizar useICRApi para usar o proxy local
- [x] Documentar configuração Docker (Dockerfile + docker-compose.example.yml)

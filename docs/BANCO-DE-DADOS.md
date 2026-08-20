# Banco de dados do EduSystem

## O banco é criado automaticamente?

Sim. O backend executa `server/src/database.js` na inicialização. Esse módulo:

1. cria o arquivo SQLite quando ele ainda não existe;
2. cria todas as tabelas necessárias;
3. aplica colunas novas em instalações antigas;
4. inclui os perfis básicos e dados de demonstração somente quando a base está vazia;
5. mantém os registros existentes durante as atualizações.

No executável portátil, o caminho principal é:

```text
C:\EduSystem\dados\database.sqlite
```

As pastas `relatorios`, `importacoes`, `anexos` e `backups` também são criadas automaticamente.

## Ferramenta recomendada

Use **DB Browser for SQLite**.

- Projeto oficial: https://sqlitebrowser.org/
- Downloads oficiais: https://sqlitebrowser.org/dl/
- Releases oficiais: https://github.com/sqlitebrowser/sqlitebrowser/releases
- No Windows, escolha a edição de 64 bits ou a edição portátil.

Não use **IBExpert** para esse projeto. O IBExpert é uma ferramenta voltada ao Firebird/InterBase, enquanto o EduSystem utiliza SQLite.

## Como visualizar com segurança

1. Feche completamente o EduSystem.
2. Copie `C:\EduSystem\dados\database.sqlite` para `C:\EduSystem\backups\`.
3. Abra a cópia no DB Browser for SQLite.
4. Use as abas `Estrutura do banco`, `Navegar dados` e `Executar SQL`.
5. Não edite senhas, chaves ou relacionamentos diretamente sem um backup.

Os arquivos `database.sqlite-wal` e `database.sqlite-shm` podem existir enquanto o aplicativo está aberto. Não copie apenas o arquivo principal durante uma gravação ativa.

## Principais tabelas

| Tabela | Conteúdo |
| --- | --- |
| `usuarios` e `perfis` | contas, cargos e status de acesso |
| `alunos` | cadastro, responsável, contatos e situação |
| `turmas` | séries, turnos, escolas e professores |
| `materias` e `cursos` | catálogo acadêmico |
| `notas` | notas, bimestres, anos e arquivamento lógico |
| `frequencias` | presença ou falta por aluno e data |
| `acompanhamentos` | histórico pedagógico |
| `escolas` e `universidades` | instituições cadastradas |
| `quadros` | estado JSON dos quadros brancos |
| `auditoria` | correções e importações relevantes |

## Backup

Uma estratégia segura para produção deve manter cópias datadas da pasta `C:\EduSystem\dados`. A sincronização automática entre computadores está apenas documentada no aplicativo e ainda não é ativada por padrão.


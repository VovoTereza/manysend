# Publicação do Manysend na Vercel

O projeto está configurado como uma SPA Vite com funções Node em `/api`.

## 1. Importar o projeto

Envie este diretório para um repositório Git e importe-o em **New Project** na Vercel. A plataforma reconhecerá o Vite; `vercel.json` já define o comando de build e a pasta `dist`.

## 2. Configurar variáveis

No projeto da Vercel, abra **Settings → Environment Variables** e cadastre as chaves listadas em `.env.example`. Cadastre secrets somente na Vercel e nunca com prefixo `VITE_`, pois variáveis `VITE_*` são incorporadas ao JavaScript público do navegador.

Use valores diferentes para Development, Preview e Production quando necessário. Depois de alterar uma variável, gere um novo deployment.

## 3. Configurar domínios e callbacks

Depois que o domínio final estiver ativo, atualize `APP_URL` e as três URLs de callback:

- `META_REDIRECT_URI=https://seu-dominio.com/api/oauth/meta/callback`
- `GOOGLE_REDIRECT_URI=https://seu-dominio.com/api/oauth/google/callback`
- `TIKTOK_REDIRECT_URI=https://seu-dominio.com/api/oauth/tiktok/callback`

As mesmas URLs precisam ser cadastradas nos consoles de desenvolvedor da Meta, Google e TikTok.

## 4. Verificação

- `/api/health` informa quais grupos de variáveis ainda faltam sem revelar nenhum secret.
- `/api/integrations` retorna o estado de configuração de Meta, YouTube e TikTok.

O retorno `503 configuration_required` em `/api/health` é esperado até que todas as variáveis sejam cadastradas.

## 5. Limite atual

A infraestrutura de deploy está pronta, mas os fluxos OAuth, armazenamento criptografado de tokens, banco de dados, filas de agendamento e webhooks ainda precisam ser implementados antes de conectar contas reais ou publicar conteúdo. A Vercel não substitui essas integrações.


# ASCEND Mobile (Expo + React Native)

Aplicativo nativo (Android/iOS) do ASCEND, usando a mesma API Spring Boot do site.

## Instalação

- Instale Node.js 22+ e Expo Go no celular.
- Copie `.env.example` para `.env` e ajuste `EXPO_PUBLIC_API_URL` para um backend acessível pelo aparelho. O URL deve terminar com `/api`.
- Execute `npm install`, `npx expo install --fix`, `npx expo install expo-secure-store` e `npx expo start`.
- Leia o QR Code usando Expo Go ou abra Android Emulator/iOS Simulator.
- Na aba IA, o usuário precisa autorizar explicitamente o envio de conteúdo/contexto ao provedor. Sem autorização, a solicitação não sai do backend para a IA externa.

## Funcionalidades

Autenticação/cadastro, armazenamento seguro do token, dashboard, missões, resgate de itens com validação server-side, inventário de compras, planejador simplificado, chat com IA e central de ajuda.

### Paridade com web

Este é um app React Native **funcional de escopo inicial**, não um clone de todas as telas HTML: calendário avançado, layouts de treinamento e ativação dos cronômetros de recompensas ainda pertencem à versão web. O app usa um catálogo mobile curado; a rotação completa da loja web não foi reproduzida.

**Nunca** use `EXPO_PUBLIC_` para segredo/chave de IA — essa variável é incluída no pacote móvel e deve conter somente o endereço da API.

## Backend

Necessita do backend atualizado: `GET /api/shop`, `POST /api/shop/purchase`, endpoints existentes `/api/auth`, `/api/player/status`, `/api/ai/chat`. As recompensas de moedas são virtuais.

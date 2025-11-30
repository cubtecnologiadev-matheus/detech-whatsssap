# 📱 detech-whatsssap

Ferramenta em **Node.js** para detectar quais números de telefone possuem **WhatsApp ativo**.

Ideal para:
- Validar base de leads
- Conferir quais números podem ser contatados via WhatsApp
- Preparar campanhas de atendimento ou marketing

---

## ⚙️ Tecnologias Utilizadas

- **Node.js**
- **npm**
- **Puppeteer / WhatsApp Web** (automação de navegador)
- JavaScript

---

## 📦 Requisitos

- Node.js instalado (versão LTS recomendada)
- npm funcionando
- Acesso à internet (usa WhatsApp Web)
- Navegador suportado pelo Puppeteer

---

## 🔧 Instalação das dependências

No Windows, você pode usar o script `instalar pendencias.bat`  
**ou** rodar os comandos manualmente:

▶️ Como iniciar o painel

Depois de instaladas as dependências:

npm start


Em seguida, abra no navegador:

http://localhost:3000


Siga as instruções do sistema para autenticar no WhatsApp Web (caso use QR Code) e iniciar o processo de verificação dos números.

📁 Estrutura básica do projeto
detech-whatsssap/
├── index.js                 # Arquivo principal da aplicação
├── package.json             # Dependências e scripts npm
├── package-lock.json
├── public/                  # Arquivos estáticos (se aplicável)
├── runs/                    # Saídas / relatórios de execuções
├── comandos pra iniciar.txt # Comandos de ajuda
├── instalar pendencias.bat  # Script para instalar dependências
└── README.md                # Documentação do projeto

⚠️ Aviso de uso

Este projeto deve ser usado apenas para fins legais, como:

Validação de base própria de contatos

Ferramentas internas de atendimento e organização

O uso para spam ou violação dos termos de uso do WhatsApp é de responsabilidade exclusiva do usuário.

👨‍💻 Autor

Matheus – Cub Tecnologia Dev
💻 Desenvolvimento Web & Automação
📧 cubtecnologia.dev@gmail.com

# 📌 PDF Marcadores

Extensão para Microsoft Edge que permite criar **marcadores conceituais personalizados para PDFs**, sem substituir ou modificar o visualizador PDF nativo do Edge.

A ideia é simples:

> **PDF continua sendo lido normalmente no Edge. A extensão funciona apenas como um índice pessoal de conceitos.**

Você pode criar vários marcadores na mesma página, dando a cada um um título próprio.

---

## 🎯 Objetivo

Durante o estudo de um livro PDF, você pode encontrar vários conceitos importantes na mesma página.

Por exemplo, na página 377:

```text
📌 Resposta em frequência — definição
📌 Princípio da causalidade
📌 Função de transferência
📌 Sistema causal
```

A extensão permite registrar esses conceitos sem modificar o PDF original.

O marcador armazena informações como:

- título definido pelo usuário;
- arquivo PDF;
- caminho/URL do PDF;
- página, quando disponível;
- texto selecionado, quando o Edge disponibilizar essa informação;
- data de criação;
- identificador único.

---

# 🚀 Como funciona

O fluxo principal é:

```text
Abrir PDF no Microsoft Edge
        ↓
Ler normalmente
        ↓
Selecionar um trecho
        ↓
Botão direito
        ↓
Adicionar marcador
        ↓
Definir o título
        ↓
Salvar
```

O objetivo é que o usuário precise informar **somente o título do marcador**.

As demais informações são preenchidas automaticamente sempre que o Microsoft Edge disponibilizar os dados necessários.

---

# 📝 Criando um marcador

Suponha que você esteja estudando:

```text
ENGENHARIA_DE_CONTROLE_MODERNO_5_a_EDICA.pdf
```

e esteja na página 377.

Você seleciona um trecho relacionado à resposta em frequência e escolhe:

> **Adicionar marcador**

A extensão apresenta:

```text
NOVO MARCADOR

Título:
[ Resposta em frequência — definição ]

Arquivo:
ENGENHARIA_DE_CONTROLE_MODERNO_5_a_EDICA.pdf

Página:
377

Trecho:
"A resposta em frequência..."

[ CANCELAR ] [ SALVAR ]
```

O título é definido manualmente pelo usuário.

As demais informações são obtidas automaticamente quando possível.

---

# 📚 Vários marcadores na mesma página

Essa é uma característica fundamental da extensão.

Os marcadores **não são bookmarks tradicionais do PDF**.

Eles são registros independentes.

Portanto, é perfeitamente válido ter:

```text
Página 377

📌 Resposta em frequência — definição
📌 Princípio da causalidade
📌 Função de transferência
📌 Sistema causal
📌 Malha aberta
```

Cada marcador possui seu próprio ID.

Um marcador nunca substitui outro simplesmente porque ambos pertencem à mesma página.

---

# 🔎 Organização dos marcadores

Os marcadores podem ser pesquisados pelo título.

Exemplo:

```text
🔎 causalidade
```

Resultado:

```text
📌 Princípio da causalidade
   Página 377
```

A intenção é transformar a extensão em um **índice pessoal de conceitos do livro**.

---

# ⚙️ Funcionamento técnico

## 1. Identificação do PDF

O visualizador PDF nativo do Microsoft Edge utiliza internamente uma página/componente próprio para renderizar o documento.

Em determinadas situações, a extensão recebe uma URL semelhante a:

```text
chrome-extension://[id-interno]/index.html
```

Essa URL **não representa o PDF**.

Por isso, `index.html` nunca deve ser utilizado como nome do documento.

A extensão tenta identificar o documento real utilizando:

```javascript
chrome.tabs.get(tab.id)
```

e informações como:

- URL da aba;
- título da aba;
- parâmetros da URL;
- identificação do arquivo.

Como salvaguarda, existe uma regra explícita:

```text
"index.html"
```

não pode ser utilizado como nome do PDF.

---

# 📄 2. Página atual

### Limitação do Microsoft Edge

A extensão **não consegue obter de maneira confiável a página atual do visualizador PDF nativo do Edge**.

O motivo é que o visualizador PDF é executado em um contexto interno e isolado do navegador.

Além disso:

- a URL do PDF não é atualizada continuamente conforme o usuário navega;
- o Edge não fornece uma API pública como `chrome.pdfViewer.getCurrentPage()`;
- extensões comuns não possuem acesso direto ao estado interno do visualizador;
- o `#page=N` não é atualizado automaticamente durante a navegação normal do PDF.

Por exemplo, estar na página 377 não significa necessariamente que a URL da aba será:

```text
arquivo.pdf#page=377
```

### Comportamento da extensão

Se existir um fragmento de página disponível na URL:

```text
#page=377
```

a extensão pode utilizar esse valor automaticamente.

Caso contrário, a página precisa ser informada manualmente.

Isso é uma limitação do acesso ao visualizador PDF nativo do Edge, e não uma limitação desejada da interface.

---

# ✍️ 3. Texto selecionado

Em páginas HTML comuns, uma extensão pode receber o texto selecionado através de:

```javascript
info.selectionText
```

Porém, o visualizador PDF nativo do Edge não se comporta como uma página HTML comum.

Dependendo da versão do Edge, do mecanismo de PDF utilizado e da forma como o documento é renderizado, a seleção pode não ser disponibilizada para a extensão.

### Comportamento da extensão

Se o Edge fornecer o texto:

```text
Trecho:
"A resposta em frequência..."
```

esse texto será armazenado.

Se o Edge não fornecer a seleção:

```text
Trecho:

Não disponível através do visualizador PDF nativo do Edge.
```

A extensão não tenta inventar ou estimar o texto.

---

# 🧩 APIs utilizadas

| Informação | API / mecanismo | Comportamento |
|---|---|---|
| PDF | `chrome.tabs.get()` + URL/título | Identifica o documento quando possível |
| Nome do PDF | `tab.title` + sanitização | Evita usar `index.html` |
| Página | `#page=N` quando disponível | Caso contrário, entrada manual |
| Texto selecionado | `info.selectionText` | Utilizado somente quando fornecido pelo Edge |
| Menu de contexto | `chrome.contextMenus` | Permite criar marcador sobre uma seleção |
| Armazenamento | `chrome.storage.local` | Persiste os marcadores |
| ID | `crypto.randomUUID()` | Garante identificadores únicos |

---

# 💾 Armazenamento

Os marcadores são armazenados localmente utilizando:

```javascript
chrome.storage.local
```

Não é necessário:

- login;
- conta Google;
- servidor;
- banco de dados externo;
- sincronização em nuvem.

Os dados pertencem à extensão instalada naquele navegador.

---

# 🗂️ Estrutura de um marcador

Um marcador possui uma estrutura semelhante a:

```json
{
  "id": "e3b0c442-98fc-1c14-9af7-4c0233dd3e21",
  "title": "Resposta em frequência — definição",
  "pdfName": "ENGENHARIA_DE_CONTROLE_MODERNO_5_a_EDICA.pdf",
  "pdfUrl": "file:///C:/Livros/ENGENHARIA_DE_CONTROLE_MODERNO_5_a_EDICA.pdf",
  "page": 377,
  "selectedText": "",
  "createdAt": "2026-10-29T14:10:00.000Z",
  "updatedAt": "2026-10-29T14:10:00.000Z"
}
```

O campo `selectedText` pode ficar vazio quando o Edge não disponibilizar a seleção.

O campo `page` pode precisar ser preenchido manualmente quando o visualizador não fornecer a página automaticamente.

---

# 🔒 O PDF original não é modificado

A extensão **não altera o arquivo PDF**.

Ela não:

- adiciona highlights ao PDF;
- adiciona comentários ao PDF;
- salva uma nova versão;
- modifica o conteúdo;
- substitui o visualizador;
- converte o PDF;
- cria uma cópia modificada.

O PDF continua sendo aberto e exibido pelo **visualizador PDF nativo do Microsoft Edge**.

Os marcadores existem somente dentro da extensão.

---

# 🖥️ Compatibilidade

O projeto foi desenvolvido para:

- Microsoft Edge;
- extensões Chromium;
- Manifest V3;
- PDFs abertos no visualizador nativo do Edge.

O funcionamento pode variar dependendo de:

- versão do Microsoft Edge;
- mecanismo de PDF utilizado;
- tipo de PDF;
- origem do arquivo;
- permissões concedidas à extensão.

---

# 🔄 Como recarregar a extensão

Depois de alterar o código:

1. Abra o Microsoft Edge.
2. Acesse:

```text
edge://extensions
```

3. Localize:

```text
PDF Marcadores
```

4. Clique no botão:

```text
🔄 Recarregar
```

5. Em **Detalhes**, confirme que:

```text
Permitir acesso a URLs de arquivo
```

está ativado.

Isso é necessário quando os PDFs são arquivos locais, por exemplo:

```text
file:///C:/Livros/Ogata.pdf
```

---

# 📌 Exemplo de uso

Imagine que você está estudando um livro de Controle Automático.

Na página 377 você encontra:

```text
Resposta em frequência
```

Você seleciona o parágrafo e cria:

```text
📌 Resposta em frequência — definição
```

Na mesma página encontra outra informação:

```text
Princípio da causalidade
```

Cria:

```text
📌 Princípio da causalidade
```

Depois, algumas páginas adiante:

```text
📌 Relação entre polos e zeros
```

Ao final, você possui um índice pessoal:

```text
ENGENHARIA_DE_CONTROLE_MODERNO_5_a_EDICA.pdf

📌 Resposta em frequência — definição      p. 377
📌 Princípio da causalidade                p. 377
📌 Relação entre polos e zeros             p. 391
📌 Avanço de fase                          p. 420
📌 Atraso de fase                          p. 426
📌 Critério de Nyquist                     p. 510
```

Isso permite recuperar rapidamente **onde determinado conceito foi estudado**, sem precisar manter uma cópia do conteúdo do livro em outro lugar.

---

# 🎯 Filosofia do projeto

A extensão não pretende ser um editor de PDF.

Ela também não pretende substituir o visualizador do Edge.

Seu objetivo é extremamente simples:

> **Transformar um PDF em um livro com um índice pessoal de conceitos.**

O PDF continua sendo a fonte completa.

Os marcadores servem apenas para responder à pergunta:

> **"Onde naquele livro estava aquele conceito que eu lembro de ter estudado?"**

---

# 🚧 Limitações conhecidas

Atualmente existem duas limitações principais impostas pelo visualizador PDF nativo do Edge:

### Página atual

Não existe uma API pública confiável para obter automaticamente o número da página atualmente visualizada.

### Texto selecionado

O texto selecionado no PDF pode não ser disponibilizado para extensões através de `info.selectionText`.

Quando essas informações não estão disponíveis, a extensão deve informar claramente a limitação em vez de apresentar dados incorretos.

---

# 🔮 Possíveis melhorias futuras

Estas funcionalidades podem ser adicionadas posteriormente, sem alterar a filosofia simples da extensão:

- [ ] navegação automática para a página do marcador;
- [ ] edição de marcadores;
- [ ] exclusão de marcadores;
- [ ] pesquisa por título;
- [ ] agrupamento por PDF;
- [ ] ordenação por página;
- [ ] exportação/importação dos marcadores;
- [ ] backup dos dados;
- [ ] atalhos de teclado;
- [ ] suporte a categorias/tags;
- [ ] contador de marcadores por PDF.

Essas funcionalidades devem ser adicionadas somente se mantiverem a extensão simples e rápida.

---

## 📜 Licença

Definir conforme a licença escolhida para o projeto.
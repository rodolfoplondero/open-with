# Abrir com programa externo

Extensão para **VS Code no Windows**: clique com o botão direito em um arquivo, escolha **Abrir com programa externo…** e selecione um aplicativo em uma lista pesquisável.

## Instalar

1. Baixe `abrir-com-externo-0.1.1.vsix`.
2. No VS Code, abra **Extensões** (`Ctrl+Shift+X`).
3. No menu **…**, selecione **Instalar do VSIX…** e escolha o arquivo.
4. Se solicitado, recarregue a janela do VS Code.

Também é possível instalar pelo terminal:

```powershell
code --install-extension .\abrir-com-externo-0.1.1.vsix
```

A extensão usa o Windows PowerShell 5.1 e as APIs Shell incluídas no Windows. Não precisa instalar Node.js ou ferramentas de desenvolvimento para usar o VSIX. Compatível com VS Code 1.96 ou posterior; destinado a Windows 10/11.

## Usar

- No Explorer do VS Code, clique com o botão direito em um **arquivo** e escolha **Abrir com programa externo…**.
- Também funciona no menu de contexto do editor e da aba do arquivo.
- Pela paleta (`Ctrl+Shift+P`), execute **Arquivo: Abrir com programa externo…** para o arquivo ativo.
- Digite o nome do programa para filtrar a lista e pressione `Enter` para abrir. `Esc` cancela.
- **Escolher outro aplicativo no Windows…** abre o diálogo nativo.
- Sem programas associados, a extensão oferece o diálogo nativo.
- Se houver alterações não salvas, escolha entre **Salvar e abrir**, **Abrir versão salva** ou cancelar.

A lista inclui somente os aplicativos que o Windows recomenda para aquele tipo de arquivo (`ASSOC_FILTER_RECOMMENDED`); os genéricos não recomendados são excluídos. “Recomendado pelo Windows” não significa necessariamente que o programa é o padrão. Essa classificação depende do registro do Windows e não é uma inspeção do conteúdo do arquivo. A extensão não modifica as associações padrão.

## Como a lista é descoberta

A extensão consulta `SHAssocEnumHandlers` para a extensão do arquivo, obtém nomes com `IAssocHandler` e passa o arquivo ao handler selecionado por `IDataObject`. Assim, usa os aplicativos que o Windows registra para esse tipo, sem manter uma lista fixa de executáveis. Arquivos e IDs são enviados em JSON pela entrada padrão do PowerShell, sem interpolação em comandos.

Nem todo programa instalado registra os formatos que suporta: esses programas podem não aparecer. Nesse caso, use a opção nativa e escolha outro aplicativo. Tipos sem extensão também usam o diálogo nativo. A disponibilidade de programas depende das associações do usuário atual.

## Limites

- Somente arquivos locais acessíveis no Windows; arquivos em WSL, SSH, contêineres e sistemas virtuais não são compatíveis.
- Pastas e documentos ainda não salvos em disco não são aceitos.
- Programas removidos ou associações alteradas após carregar a lista podem causar erro; execute o comando novamente.
- Políticas corporativas que bloqueiam PowerShell ou `Add-Type` podem impedir a consulta e a abertura. A extensão não contorna políticas de grupo.
- A confirmação de abertura indica que o Windows aceitou o pedido; não monitora a janela ou o funcionamento do aplicativo externo.
- A extensão não faz requisições de rede nem coleta telemetria. O aplicativo escolhido recebe o arquivo para abri-lo.

## Desenvolver

Requer Node.js 22 ou posterior e npm. Extraia o ZIP de fontes, abra a pasta no VS Code e execute:

```sh
npm ci
npm test
npm run package
```

Pressione `F5` para abrir uma janela de desenvolvimento da extensão. O pacote compilado estará em `abrir-com-externo-0.1.1.vsix`. O identificador `local-tools.abrir-com-externo` é para distribuição local; não houve publicação no Marketplace.

### Estrutura

- `src/extension.ts`: menus, Quick Pick e integração com VS Code.
- `src/command.ts`: fluxo, validação e fallback.
- `src/windows.ts`: comunicação por JSON e validação da resposta.
- `scripts/bridge.ps1`: entrada do PowerShell.
- `scripts/Associations.cs`: APIs COM/Shell do Windows.
- `test/`: testes automatizados de fluxo e transporte com fronteiras do sistema simuladas.

## Validação

Os testes automatizados e a compilação TypeScript são executados em Linux. Também foi verificada a compilação do C# e uma chamada sem extensão usando PowerShell 7 em Linux. Os testes verificam a lógica e o transporte com o Windows simulado; **não comprovam a enumeração nem a abertura real de aplicativos no Windows**.

Antes de distribuir para outras pessoas, confira em Windows 10/11:

- Instalar o VSIX e verificar menus e paleta.
- Abrir `.txt`, `.png`, `.pdf` e outro formato com mais de um aplicativo registrado; comparar com “Abrir com” do Explorer do Windows.
- Selecionar aplicativos tradicionais e da Microsoft Store, quando disponíveis, com o aplicativo fechado (primeira abertura) e já aberto; conferir ativação assíncrona e programas que usam DDE.
- Usar nomes com espaços, acentos, `&`, colchetes e apóstrofos.
- Cancelar a lista e o diálogo nativo sem abrir o arquivo.
- Experimentar formato desconhecido e arquivo sem extensão.
- Verificar salvamento, abertura da versão em disco e cancelamento de alterações não salvas.
- Remover ou alterar uma associação com a lista aberta e verificar a mensagem de erro.
- Conferir rejeição de pastas e arquivos remotos.

Licença MIT.

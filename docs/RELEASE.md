# Versão, distribuição e atualização no Fedora

## Contrato de versão

`package.json.version` é a fonte única da versão do aplicativo. `npm version
<versão> --no-git-tag-version` atualiza essa fonte e suas cópias no
`package-lock.json`, sem commit ou tag automáticos. Não edite o lockfile à mão.
O Electron lê a versão do `package.json` dentro do ASAR; o build confere esse
valor, o cabeçalho RPM e o manifesto antes de aceitar o pacote.

O canal publicado aceita SemVer estável `MAJOR.MINOR.PATCH`: MAJOR para mudanças
incompatíveis, MINOR para funcionalidades compatíveis, PATCH para correções.
Tags têm formato exato `vMAJOR.MINOR.PATCH`. Pré-releases e sufixos `+metadata`
são rejeitados neste canal, evitando ordenações ambíguas no RPM/DNF. Uma futura
via de testes precisará definir e testar a conversão para RPM EVR antes de
aceitá-los. Cada versão publicada é definitiva: não mova tags nem substitua RPMs.
Uma correção de empacotamento publicada também exige novo PATCH.

O RPM usa `Version = package.json.version`, `Release = 1`, arquitetura `x86_64`.
O manifesto `release/release.json` registra versão, tag, Electron, nome,
arquitetura, RPM EVR, commit de origem, checkout modificado e SHA-256. Builds
locais modificados são permitidos e identificados por `dirty: true`; publicação
exige checkout limpo e o mesmo commit da tag. As versões de esquema dos backups
não são versões do aplicativo e permanecem independentes.

## Build e validação reproduzíveis

Pré-requisitos: Git, Node.js 22 (>=22.12), npm e Podman, em host Linux x86_64.

```sh
npm run release:check
```

Esse comando usa o mesmo caminho do CI:

1. Imagem de build Fedora 44, FPM 1.18.0 e instalação por `npm ci`.
2. Verificação de versão, TypeScript (`lint`), todos os testes de regressão e
   testes do processo de release.
3. Vite e electron-builder com Electron **44.2.0**, RPM x86_64 e publicação
   desabilitada. Não depende do número de execução do CI para o RPM Release.
4. Conferência da versão dentro do ASAR e no RPM; geração de `SHA256SUMS` e
   `release.json`.
5. Outro contêiner, iniciado de Fedora 44 limpo, instala o RPM via DNF antes
   das ferramentas de teste. Confere versão, dependências, bibliotecas, atalho,
   integridade dos arquivos instalados e navegação pelos módulos/subabas.
   Ao final, remove via DNF e verifica ausência de arquivos, links, atalhos e
   ícones do pacote e dependências quebradas. FPM pode deixar diretórios vazios
   não pertencentes ao pacote em `/opt`; nenhum arquivo de aplicação deve permanecer.
   Executa o Electron como usuário comum, com sandbox, Xvfb, perfil descartável,
   rede do aplicativo bloqueada e verificação do preload/IPC e do renderer.

Saídas: `release/Madeireira-Sol-Nascente-<versão>-x86_64.rpm`,
`release/SHA256SUMS`, `release/release.json` e `release/validation/`.
`node_modules` usa volume anônimo removido ao final; somente o download do
Electron usa cache persistente. Worktrees vinculados são suportados: seus
metadados Git são montados somente para leitura, sem bloquear ou alterar o índice. O código funcional e o perfil do usuário não
são alterados. Builds simultâneos devem usar checkouts separados, pois `release/`
é o diretório de saída de cada checkout.

No runner Ubuntu 24.04 descartável do CI, a restrição AppArmor a namespaces
de usuários é relaxada para permitir Podman/Chromium aninhados. Isso não altera
o host Fedora do usuário nem desativa o sandbox do aplicativo instalado.

A instalação npm é reproduzível pelo lockfile, mas não se promete RPM idêntico
byte a byte: timestamps, imagem Fedora e atualizações dos repositórios podem
variar. A publicação promove o **mesmo RPM validado**, sem reconstruí-lo.
A validação em contêiner não substitui teste em hardware/sessão gráfica real;
login real Firebase/Google Drive não é feito, e seus contratos são protegidos
pelos testes com mocks. Não são usados dados de produção.

## Próxima release

Na branch `madeireira-sol-nascente-rpm`, escolha uma versão ainda não publicada:

```sh
npm version 1.0.1 --no-git-tag-version
npm run release:check
# Revise o diff; adicione apenas os arquivos pertencentes à release.
git add package.json package-lock.json
git commit -m "chore: release 1.0.1"
git tag -a v1.0.1 -m "Madeireira Sol Nascente 1.0.1"
git push origin madeireira-sol-nascente-rpm
git push origin v1.0.1
```

A configuração inicial deste processo também precisa ser revisada e commitada
explicitamente antes de publicar uma tag. Não use `git add .` em um checkout com
alterações externas. Não inclua `.claude/helpers/.helpers-version`,
`.claude/helpers/helpers.manifest.json`, `CLAUDE.md` ou `firestore.rules` nesta
entrega. Nenhum comando deste processo altera a branch `main`.

PRs e pushes da branch executam a validação completa. Tags `v*` também executam
a validação e precisam corresponder ao pacote e apontar para um commit ancestral
da branch RPM. Só um push de tag aprovado libera o job de publicação, que
confere novamente checksum, metadados e commit do artefato baixado do job anterior.
O `GITHUB_TOKEN` tem leitura no build e escrita somente no job de publicação.
Não são necessários tokens pessoais. O repositório precisa permitir GitHub
Actions e a permissão `contents: write` desse job.

O GitHub CLI cria a release em draft, envia os três assets e só então a publica
([comportamento oficial](https://cli.github.com/manual/gh_release_create)).
`--verify-tag` impede criação implícita de tag. Release existente não é
sobrescrita. Se o upload falhar e deixar um draft, revise/remova manualmente esse
draft antes de repetir o job. Se testes, build ou validação falharem, o job de
publicação não roda. Execução manual e push da branch nunca publicam releases.
Configure proteção contra remoção/atualização de tags `v*` nas regras do GitHub;
essa configuração administrativa não é aplicada automaticamente pelo workflow.

## Atualização: GitHub Releases e DNF explícito

O canal atual distribui RPMs pelo GitHub Releases. Para instalar/atualizar,
feche o aplicativo, escolha uma release estável e baixe o pacote exato e seu
checksum. Exemplo em Fedora x86_64 com GitHub CLI instalado:

```sh
version=1.0.1
repo=cesarmartinstaborda-bit/madeireira-sol-nascente
update_dir=$(mktemp -d)
gh release view "v$version" --repo "$repo"
gh release download "v$version" --repo "$repo" --dir "$update_dir" \
  --pattern "Madeireira-Sol-Nascente-$version-x86_64.rpm" \
  --pattern SHA256SUMS --pattern release.json
cd "$update_dir"
sha256sum --check --strict SHA256SUMS
# Só prossiga se o checksum estiver OK. Confira nome, versão e arquitetura:
rpm -qp --queryformat '%{NAME} %{VERSION}-%{RELEASE} %{ARCH}\n' \
  "Madeireira-Sol-Nascente-$version-x86_64.rpm"
sudo dnf install "./Madeireira-Sol-Nascente-$version-x86_64.rpm"
```

Execute cada etapa apenas se a anterior tiver sucesso. O DNF apresenta a
transação para confirmação, resolve dependências e atualiza a instalação
existente; não há instalação privilegiada silenciosa, serviço novo ou interface
nova no aplicativo. Não remova o perfil para atualizar. Faça backup pelo fluxo
existente antes de uma atualização; não use downgrade/`--allowerasing` como
rotina. Baixar e verificar também pode ser feito manualmente pela página de
Releases. SHA-256 detecta corrupção; não substitui assinatura do publicador.
A origem confiável neste estágio é o repositório oficial via HTTPS/GitHub.

Avaliação técnica:

- **GitHub Releases:** adequado à infraestrutura atual; associa pacote validado
  à versão, commit e checksum. Não é, por si só, um repositório DNF.
- **Electron autoUpdater:** não possui suporte integrado no Linux e recomenda
  o gerenciador da distribuição. Não adicionamos um atualizador AppImage ou um
  mecanismo próprio para substituir arquivos pertencentes ao RPM.
- **electron-updater (biblioteca separada):** possui `RpmUpdater`, mas não está
  instalado no aplicativo. A configuração do electron-builder anuncia
  os arquivos de auto-update RPM como beta; gerar esses arquivos não ativa um
  atualizador. Adotar a biblioteca exigiria integração no processo principal,
  política de autorização e assinatura e testes adicionais. A documentação
  atual também registra que pacotes Linux não verificados são permitidos por
  padrão. Não adotamos essa integração sem uma cadeia de assinatura definida
  ([documentação oficial](https://www.electron.build/docs/features/auto-update/)).
- **Repositório RPM/DNF assinado:** melhor evolução para receber atualizações
  pelo DNF e ferramentas gráficas do Fedora. Exige hospedagem durável de
  `repodata`, assinatura de RPMs/metadados, chave pública distribuída por canal
  verificável, chave privada protegida, rotação/revogação, retenção e testes de
  upgrade. Não há essa infraestrutura de confiança configurada neste projeto.

Para evoluir, provisionar assinatura e hospedagem, promover somente os RPMs
aprovados neste CI para um repositório criado com `createrepo_c`, publicar
metadados atomicamente e distribuir um pacote de configuração `.repo` com
`gpgcheck=1` (e validação dos metadados assinados). Testar instalação, upgrade e
rotação de chaves em Fedora limpo antes de ativar o canal. O usuário habilitará
o repositório explicitamente e poderá atualizar via `dnf upgrade`, mantendo o
modelo de autorização do Fedora. Até lá, não se promete atualização automática.

Referências: [Electron autoUpdater](https://www.electronjs.org/docs/latest/api/auto-updater/),
[DNF install](https://dnf5.readthedocs.io/en/latest/commands/install.8.html),
[configuração de repositórios DNF](https://dnf5.readthedocs.io/en/latest/dnf5.conf.5.html).
AppImage permanece somente como fallback pelo comando `npm run dist:appimage`;
não participa da publicação oficial nem do fluxo de atualização RPM.

## Correções de segurança do empacotador

O electron-builder está fixado em 26.15.3 para corrigir os avisos de segurança
do builder-util-runtime, AppImage e tar encontrados na cadeia 25.1.8. Electron
permanece em 44.2.0 e as dependências de produção mantêm suas versões.
A instalação oficial continua usando `npm ci` e `package-lock.json`.

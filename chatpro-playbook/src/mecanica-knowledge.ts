import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { vaultFolderForTeam } from './attendance-team.js';

function note(title: string, body: string) {
  return [
    '---',
    `title: ${title}`,
    'tipo: conhecimento-mecanica',
    'equipe: mecanica',
    'fonte: chatpro-playbook',
    'regra: nao-inventar-diagnostico',
    '---',
    '',
    body.trim(),
    '',
  ].join('\n');
}

const KNOWLEDGE_FILES: Array<{ relative: string; body: string }> = [
  {
    relative: 'Conhecimento/Linhas de equipamento.md',
    body: note('Linhas de equipamento', `
# Linhas de equipamento

A mecânica da Acesso atende a frota locada. Quatro linhas principais (catálogo do site):

- [[Plataformas elevatorias]] — tesoura, articulada, telescópica e mastro (28 fichas)
- [[Andaimes]] — tubo e braçadeira, painéis, pisos, sapatas, guarda-corpo; escada de fibra
- [[Ferramentas eletricas]] — 220 V e bateria no canteiro (martelete, betoneira, serra, etc.)
- [[Ferramentas a combustao]] — gasolina (gerador, placa, cortadora de piso, compactador, roçadeira, motor vibrador)

Também passam pela mesma mesa, se houver chamado: munck, Franna, talha, mini grua e manipulador telescópico.

O bot **não repara** e **não confirma peça nem prazo**. Qualifica modelo, sintoma e se a máquina parou com gente na cesta; a mecânica decide o deslocamento.
`),
  },
  {
    relative: 'Conhecimento/Plataformas elevatorias.md',
    body: note('Plataformas elevatórias', `
# Plataformas elevatórias

Catálogo publicado no site (28 modelos). **Não confirma estoque nem prazo.** Altura e alimentação vêm da ficha. GS, SJ III, HB e PEP são tesoura.

## Tesoura (elétrica / bateria)

- Hybrid HB P830 — ~4,3 m
- Hybrid HB 1430 — ~6,1 m
- Hydrolift PEP 590 — ~6 m
- Genie GS 1930S — ~7,9 m
- Genie GS-1932M — ~8 m
- Skyjack SJIII 3219 — ~8 m
- Skyjack SJ III 3226 — ~10 m
- JLG 2632R — ~10 m
- Skyjack SJIII 4632 — ~12 m
- Skyjack SJ4732 — ~12 m
- Genie GS 3246 — ~12 m
- Skyjack SJ III 4740 — ~13,8 m
- Genie GS-4046 — ~14 m
- Genie GS-4655E — ~15,9 m

## Articulada elétrica / bateria

- Genie Z34/22N — ~12,5 m
- JLG E450AJ — ~15,7 m
- Genie Z45/25J DC — ~15,9 m, 227 kg na cesta
- Genie Z60/37 DC — ~20,2 m

## Articulada diesel

- Skyjack SJ45AJ+ — ~15,5 m
- Manitou 160 ATJ — ~16 m, 230 kg na cesta
- Genie S-60J — ~20,5 m (ficha: lança telescópica, diesel)
- Genie S80 J — ~26 m

## Telescópica diesel

- Genie S80 — ~26 m
- JLG 1350SJP — ~43,3 m

## Mastro vertical (elétrica / bateria)

- JLG 20 MVL — ~8 m
- Skyjack SJ20 — ~8,1 m
- Genie AWP 30S — ~11 m, ~159 kg na cesta
- JLG AM-36 — ~11 m (título da ficha: 13 m)

## O que perguntar no chamado

- Modelo (placa) e se é tesoura, articulada, telescópica ou mastro
- O que parou: sobe, desce, desloca, estabiliza, gira
- Painel acende? Alarme ou código?
- Gente na gaiola agora? Se sim: parar, descer pela emergência se treinado, não improvisar
- Piso, desnível, vento, sobrecarga

## Sinais típicos (só para classificar, não para consertar por WhatsApp)

- Não abaixa / não sobe: hidráulico, emergência, intertravamento da gaiola
- Não anda com cesta elevada: interlock de deslocamento (muitas tesouras)
- Inclinação / “não nivela”: piso ou sensor de nível
- Elétrica DC: bateria / carregador; diesel: motor e combustível

Fora do expediente: anotar modelo + sintoma e dizer que a mecânica retorna no próximo dia útil, 7h30–17h15. Emergência com operador preso: orientar parar e acionar o encarregado da obra; não inventar procedimento.
`),
  },
  {
    relative: 'Conhecimento/Andaimes.md',
    body: note('Andaimes', `
# Andaimes

Linha tubo e braçadeira e acessórios: tubos 0,50 m a 6 m, painéis, pisos metálicos, sapatas fixa e ajustável, rodízio, guarda-corpo, rodapé, diagonal, escada, abraçadeira fixa e giratória, luva, pranchão.

## Chamado

- Peça (painel, piso, sapata, guarda-corpo, abraçadeira) e quantidade
- Folga, trinca, deformação, falta de trava ou piso incompleto
- Altura da torre e se está em uso

Não autorizar continuar a montagem se falta guarda-corpo, piso ou sapata. Troca de peça vai para logística; peça danificada na obra é mecânica + logística. Sem “pode usar assim”.
`),
  },
  {
    relative: 'Conhecimento/Ferramentas eletricas.md',
    body: note('Ferramentas elétricas', `
# Ferramentas elétricas

Catálogo publicado no site. **Não confirma estoque.** Alimentação da ficha; várias peças são 220 V, algumas a bateria. Escada de fibra está em [[Andaimes]], não nesta linha.

## Mistura e concreto

- Argamassadeira M-120L bifásica/trifásica — 220 V (conforme modelo)
- Betoneira — 220 V (conforme modelo)
- Misturador argamassa portátil — elétrica
- Bomba lameira — 220 V (conforme modelo)
- Bomba mangote e bomba mangote 75" — 220 V (conforme modelo)
- Mangote vibrador; mangote 25 mm 5 m; mangote 35 mm 3 m Bosch; mangote 35 mm 3 m Makita — 220 V (conforme modelo)
- Vibrador concreto portátil e vibrador Bosch — 220 V (conforme modelo)
- Motor vibrador elétrico bifásico e trifásico
- Motor elétrico portátil Bosch

## Corte e desbaste

- Cortadora de parede 125 mm 5" 220 V
- Cortadora de bloco 350 mm 220 V
- Cortadora de porcelanato 220 V
- Cortadora a bateria 230 mm
- Esmerilhadeiras 4,5" e 7" 220 V
- Makitão — 220 V
- Serra circular 7" e 9" 220 V
- Serra de bancada — 220 V
- Serra de mármore 220 V
- Serra policorte 14" 220 V
- Serra sabre — 220 V
- Serra tico-tico 220 V

## Furação e demolição

- Furadeiras 1/2 e 5/8 220 V
- Martelete SDS combinado
- Marteletes demolidores Hilti TE 500, TE 700, TE 1000 e TE 2000
- Martelo demolidor 5 kg, 10 kg, 15 kg, 18 kg e 30 kg
- Chave de impacto 3/4 bateria (nome da ficha)
- Parafusadeira elétrica 220 V
- Parafusadeira/furadeira à bateria

## Acabamento e limpeza

- Lixadeira 7" 220 V, lixadeira 9" 220 V, lixadeira orbital treme-treme
- Plaina 220 V
- Retífica 220 V
- Lavadora de alta pressão; lavadora HD 585 1300 lbs
- Aspirador pó e água — 220 V, 1400 W

## Obra e içamento (ficha nesta categoria)

- Compactador elétrico
- Compressor 220 V
- Máquina de solda 250 A — 220 V
- Nível laser e nível laser rotativo — bateria
- Painel de comando — 220 V
- Transformador
- Guincho de coluna 200 kg — 220 V
- Mini grua 500 kg
- Talha 1 t

## Chamado

- Qual ferramenta e se é 220 V, trifásica ou bateria
- Não liga, desarma disjuntor, cheiro de queimado, cabo, carvão, não percuta (martelete)
- Obra tem 220 V estável? Extensão inadequada é causa comum

Cheiro de queimado ou cabo descascado: parar e isolar. Não pedir para “testar em outra tomada” se houver choque ou fumaça. Peça e prazo só a mecânica confirma.
`),
  },
  {
    relative: 'Conhecimento/Ferramentas a combustao.md',
    body: note('Ferramentas a combustão', `
# Ferramentas a combustão

Catálogo publicado no site (6 fichas nesta categoria). **Não confirma estoque.** São linha a gasolina / combustão — não tratar como 220 V.

- Compactador a gasolina — compactar solos
- Cortadora de piso a gasolina — obra civil e reforma
- Gerador a gasolina — geração em obra
- Motor vibrador a combustão — adensamento de concreto
- Placa vibratória a gasolina — compactação de solo e base
- Roçadeira

Há compactador elétrico e motor vibrador elétrico na linha [[Ferramentas eletricas]] — não misturar no chamado.

## Chamado

- Equipamento e se pega, morre, fumaça preta/azul, vazamento de combustível
- Combustível (gasolina), óleo, filtro de ar, ambiente fechado (gerador = CO)

Não orientar mistura, afogador ou “puxe até pegar” por WhatsApp. Vazamento ou cheiro forte: desligar, afastar, não fumar. Ambiente interno: gerador só com ventilação; se houver mal-estar, sair e chamar socorro — a locadora não diagnostica isso no chat.
`),
  },
  {
    relative: 'Conhecimento/Regras da mecanica.md',
    body: note('Regras da mecânica', `
# Regras da mecânica

- Não inventar diagnóstico, peça, código de falha nem prazo de visita
- Não confirmar preço de locação nem frete (isso é comercial)
- Qualificar: linha (plataforma / andaime / elétrica / combustão), modelo, sintoma, se parou a obra
- Operador em risco (cesta, choque, combustível): parar, acionar responsável da obra, registrar para a mecânica
- Fora do expediente: receber o chamado e dizer que a mecânica retorna no próximo dia útil, 7h30–17h15
- Manual do fabricante só se estiver em [[Manuais]]; se não estiver, não chutar o procedimento
`),
  },
  {
    relative: 'Manuais/Como usar esta pasta.md',
    body: note('Como usar manuais', `
# Como usar esta pasta

Coloque aqui **notas .md** da mecânica (trechos que a equipe autoriza o bot a ler). Exemplos de nome:

- \`Z34-emergencia.md\`
- \`Tesoura-GS-interlock.md\`
- \`Martelete-nao-percuta.md\`

PDF do fabricante **não é lido** pela busca. Se precisar do manual, copie o trecho útil para um \`.md\` (procedimento de emergência, interlock, abastecimento). O worker **não apaga** esta pasta.

O bot só cita o que encontrar nestas notas. Sem nota, ele encaminha para a mecânica humana.
`),
  },
];

/**
 * Creates mechanic knowledge notes once. After the seed marker exists, missing files stay missing (the trainer may have dropped them).
 */
export function ensureMecanicaKnowledge(options: {
  vaultPath: string;
  companyFolder: string;
}) {
  const folder = join(
    options.vaultPath,
    ...vaultFolderForTeam(options.companyFolder, 'mecanica').split(/[\\/]/u),
  );
  const marker = join(folder, 'Modulos', '_seed-ok.md');
  if (existsSync(marker)) {
    return { folder, written: [] as string[] };
  }
  const written: string[] = [];
  for (const file of KNOWLEDGE_FILES) {
    const path = join(folder, ...file.relative.split(/[\\/]/u));
    mkdirSync(dirname(path), { recursive: true });
    if (existsSync(path)) {
      continue;
    }
    writeFileSync(path, file.body, 'utf8');
    written.push(file.relative);
  }
  mkdirSync(dirname(marker), { recursive: true });
  writeFileSync(
    marker,
    [
      '---',
      'title: Seed mecânica',
      'tipo: modulo-operacional',
      'fonte: chatpro-playbook',
      '---',
      '',
      '# Seed inicial',
      '',
      'As notas de `Conhecimento/` nasceram da frota. O treino pode **editar ou apagar** esses módulos. Este marcador impede o worker de recriar o que a IA removeu.',
      '',
    ].join('\n'),
    'utf8',
  );
  return { folder, written };
}

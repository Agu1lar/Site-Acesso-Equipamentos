import { createBlogEditorImage, parseBlogTagMarkup } from '@/lib/blog-tag-markup';
import { estimateReadingMinutes } from '@/lib/blog-tiptap';
import type { BlogRelatedLink } from '@/types/blog-article';

const IMG_BASE = '/blog/load-sensing-pemt';

const images = [
  createBlogEditorImage(
    `${IMG_BASE}/celulas-carga.png`,
    'Esquema do cesto com células de carga / pinos instrumentados entre a plataforma e a estrutura de sustentação',
  ),
  createBlogEditorImage(
    `${IMG_BASE}/pressao-hidraulica.png`,
    'Plataforma tesoura com sensor de pressão no cilindro hidráulico e leitura de ângulo/altura',
  ),
  createBlogEditorImage(
    `${IMG_BASE}/forca-externa.png`,
    'Força de reação ao empurrar contra uma estrutura: massa de 170 kg pode corresponder a força efetiva de 240 kg',
  ),
  createBlogEditorImage(
    `${IMG_BASE}/arquiteturas-pemt.png`,
    'Comparativo de arquiteturas: tesoura (pressão + ângulo), articulada (célula + posição) e telescópica (carga + extensão + momento)',
  ),
  createBlogEditorImage(
    `${IMG_BASE}/bypass-nao-e-manutencao.png`,
    'Bypass não é manutenção: anular o Load Sensing transforma falha detectável em risco invisível',
  ),
];

const markup = `
O Load Sensing System de uma PEMT — Plataforma Elevatória Móvel de Trabalho — não é simplesmente uma “balança no cesto”. Sua função é impedir que a máquina ultrapasse limites estruturais, de estabilidade ou de operação segura.

A leitura precisa ser analisada em conjunto com carga aplicada na plataforma, posição e distribuição dessa carga, ângulo e extensão da lança, inclinação do chassi, momento de tombamento, forças externas contra estruturas e condições hidráulicas e mecânicas da máquina.

As normas reconhecem estratégias diferentes — detecção de carga, controle de posição, limitação de envelope e monitoramento de momento. [negrito]Não existe uma única arquitetura ideal para todas as PEMTs[/negrito].

[citacao]Bypass não é manutenção. Ele transforma uma falha detectável em uma condição perigosa e invisível.[/citacao]

[h2]Principais tecnologias de detecção de carga[/h2]

[h3]Células de carga e pinos instrumentados[/h3]

Instalados entre a plataforma e a estrutura de sustentação, medem diretamente força ou deformação.

[img1]

[tabela]
Aspecto | Células / pinos instrumentados
Vantagens | Medição direta da carga; maior precisão; possibilidade de detectar carga excêntrica; menor dependência da geometria da lança
Limitações | Sensibilidade a impactos e deformações; necessidade de compensação térmica; risco de perda de calibração; exigência de proteção contra forças laterais e sobrecargas mecânicas
Boas práticas de projeto | Sensores protegidos, batentes mecânicos, compensação de temperatura e comparação entre múltiplos canais
[/tabela]

[h3]Sensores de pressão hidráulica[/h3]

Medem a pressão no cilindro de elevação e estimam a carga pela relação entre força hidráulica e geometria. São especialmente adequados para [negrito]plataformas tesoura[/negrito], nas quais o sistema pode combinar pressão do cilindro, altura ou ângulo da tesoura, posição da plataforma e um modelo matemático do mecanismo.

[img2]

A viscosidade do óleo [negrito]não altera diretamente[/negrito] a relação estática entre força, pressão e área. A temperatura interfere principalmente no atrito das vedações, na histerese, nas perdas hidráulicas, na pressão residual e na resposta transitória.

Em lanças articuladas ou telescópicas, a pressão hidráulica [italico]isolada[/italico] é menos confiável como estimativa de carga: também depende do peso da lança, extensão, ângulo, aceleração, atrito e geometria do cilindro.

[h2]O suposto “falso alarme”[/h2]

Uma plataforma pode estar carregada com apenas 170 kg e indicar momentaneamente 240 kg quando o operador empurra uma ferramenta ou peça contra uma estrutura. Isso [negrito]nem sempre[/negrito] representa erro do sensor.

Se o operador empurra contra o teto, a estrutura exerce uma força de reação. Essa força é transmitida à plataforma e pode produzir um esforço equivalente a uma carga adicional. A massa presente continua sendo 170 kg, mas a força suportada pela máquina pode realmente corresponder a 240 kg.

[img3]

[tabela]
Situação | O que significa | Conduta correta
Pico transitório | Impacto curto | Filtragem validada pelo fabricante — nunca “ignorar tudo o que for rápido”
Força externa sustentada | Esforço real transmitido à máquina | Deve ser considerado pelo sistema de segurança
Leitura incorreta com plataforma livre | Possível deriva, defeito elétrico, desalinhamento, deformação ou atrito | Diagnóstico e manutenção — não bypass
[/tabela]

O filtro eletrônico não pode simplesmente descartar toda variação rápida: isso criaria uma janela perigosa durante a colocação repentina de uma carga real.

[h2]Bloqueio e recuperação segura[/h2]

O bloqueio absoluto de todos os movimentos pode evitar o agravamento da sobrecarga, mas também pode deixar o operador dependente dos controles de solo ou da descida de emergência.

Uma solução mais avançada bloqueia apenas os movimentos que aumentam o risco e permite recuperação controlada. Essa lógica, porém, [negrito]precisa considerar a geometria da máquina[/negrito].

“Permitir sempre a descida” não é necessariamente seguro:

[lista]
- Baixar uma lança articulada pode aumentar momentaneamente o alcance
- O movimento pode pressionar a plataforma contra uma estrutura
- Uma sequência incorreta pode aumentar o momento de tombamento
- Retração, giro ou descida podem criar risco de esmagamento
[/lista]

A máquina deve determinar quais movimentos [negrito]reduzem efetivamente o risco[/negrito] na configuração atual — não um atalho genérico de “sempre descer”.

[h2]Arquitetura recomendada por tipo de PEMT[/h2]

Não existe uma solução única. O quadro abaixo resume arquiteturas coerentes com o tipo de máquina:

[img4]

[tabela]
Tipo de PEMT | Arquitetura recomendada
Tesoura elétrica | Pressão hidráulica combinada com altura ou ângulo
Mastro vertical | Sensor direto ou sistema mecânico específico
Lança articulada | Medição direta na plataforma combinada com sensores de posição
Lança telescópica | Carga direta, extensão, ângulo e supervisão de momento
Capacidade variável | Fusão entre carga, posição, inclinação e envelope permitido
[/tabela]

Para lanças articuladas e telescópicas, a melhor solução costuma ser [negrito]híbrida[/negrito]: a célula mede a carga da plataforma, os sensores geométricos determinam a posição e a pressão hidráulica pode funcionar como canal complementar de plausibilidade.

Nenhum sensor isolado possui informação suficiente para avaliar todos os riscos.

[h2]O bypass não é manutenção[/h2]

Posição editorial clara: o bypass [negrito]não corrige[/negrito] um falso alarme. Ele mascara a falha e remove a última linha de defesa que o sistema foi projetado para oferecer.

[img5]

A abordagem correta é diagnóstica — firme, porém educativa:

[lista-numerada]
1. Retirar a PEMT de operação
2. Confirmar a carga, os ocupantes e os acessórios instalados
3. Verificar contatos externos e deformações na plataforma
4. Procurar travamentos, atritos ou desalinhamentos
5. Consultar códigos de falha
6. Analisar os valores individuais dos sensores
7. Inspecionar chicotes, conectores e alimentação elétrica
8. Conferir o zero com a plataforma descarregada
9. Calibrar conforme o procedimento do fabricante
10. Realizar testes funcionais antes da liberação
[/lista-numerada]

[citacao]Este artigo não apresenta pinagens, pontes elétricas nem instruções para desativar sensores. Isso não é conteúdo técnico útil — é risco operacional e jurídico.[/citacao]

[h2]Calibração e manutenção[/h2]

Não é correto afirmar que todas as PEMTs exigem necessariamente ensaios com 50%, 100% e 110% da capacidade. O procedimento depende da marca, do modelo, da arquitetura e da orientação do fabricante.

Algumas máquinas exigem pesos aferidos; outras oferecem calibração sem carga ou sistemas automáticos de compensação.

A falta de padronização entre fabricantes é um problema real para locadoras:

[lista]
- Analisadores diferentes
- Senhas ou níveis de serviço
- Procedimentos específicos por modelo
- Pesos de referência
- Softwares proprietários
- Documentação técnica fragmentada
[/lista]

Apesar disso, qualquer intervenção deve respeitar o procedimento do fabricante. Uma calibração aparentemente bem-sucedida [negrito]não substitui[/negrito] o teste funcional final.

[h2]Telemetria e calibração remota[/h2]

A telemetria é uma evolução importante para detectar deriva gradual, registrar sobrecargas, identificar impactos, comparar canais de sensores, antecipar manutenção, acompanhar falhas recorrentes e manter trilha de auditoria.

Contudo, calibração continua sendo uma [negrito]atividade física[/negrito]. A nuvem não confirma sozinha se a plataforma está vazia, livre de interferências, corretamente nivelada e sem acessórios não cadastrados.

Arquitetura recomendada: [negrito]diagnóstico remoto com calibração local assistida[/negrito].

[tabela]
Camada | Papel | Limite
Controlador de segurança | Continua funcionando sem internet | Malha crítica local
Nuvem / telemetria | Diagnóstico, histórico, alertas, auditoria | Não participa da malha crítica; sem função de bypass
Calibração remota assistida | Orienta o técnico | Exige presença física, modo de serviço habilitado, autenticação, registro e validação local
[/tabela]

[h2]Conclusão[/h2]

A discussão não é “célula de carga contra sensor hidráulico”. Cada tecnologia atende melhor a determinadas arquiteturas.

Para tesouras, a combinação de pressão e posição pode oferecer boa robustez. Para lanças de grande alcance, a solução mais segura integra medição direta da plataforma, posição da lança, extensão, inclinação e supervisão de momento.

Falsos alarmes precisam ser diagnosticados — mas nem toda leitura elevada é falsa: forças externas também fazem parte da carga efetivamente transmitida à máquina.

A evolução correta está em sistemas híbridos, autodiagnóstico, telemetria e manutenção rastreável — [negrito]nunca na anulação do dispositivo de segurança[/negrito].

Na Acesso Equipamentos, a operação segura de plataformas elevatórias passa por frota bem mantida, orientação ao cliente e respeito aos sistemas de proteção da máquina. Se você precisa locar PEMT para obra na região metropolitana de Belo Horizonte:

[botao url="/orcamento"]Solicitar orçamento de plataformas[/botao]
`.trim();

export const BLOG_LOAD_SENSING_PEMT = {
  slug: 'load-sensing-pemt-seguranca-falsos-alarmes-bypass',
  title: 'Load Sensing em PEMTs: segurança, falsos alarmes e os riscos do bypass',
  excerpt:
    'Como os sistemas de detecção de carga funcionam em plataformas elevatórias, por que ocorrem bloqueios e como diagnosticar sem desativar dispositivos de segurança.',
  metaTitle: 'Load Sensing em PEMTs: falsos alarmes e bypass | Acesso',
  metaDescription:
    'Guia técnico sobre Load Sensing em PEMTs: células de carga, pressão hidráulica, falsos alarmes, bloqueio seguro, calibração e por que bypass não é manutenção.',
  coverImageUrl: `${IMG_BASE}/cover.png`,
  publishedAt: '2026-09-17',
  relatedLinks: [
    { label: 'Plataformas elevatórias', href: '/categorias/plataformas-elevatorias' },
    { label: 'Protótipo anti-esmagamento em tesoura', href: '/dicas/prototipo-anti-esmagamento-plataforma-tesoura' },
    { label: 'Treinamento em plataformas aéreas', href: '/treinamento-plataformas-aereas' },
    { label: 'Solicitar orçamento', href: '/orcamento' },
  ] satisfies BlogRelatedLink[],
  content: parseBlogTagMarkup(markup, images),
};

export const BLOG_LOAD_SENSING_PEMT_READING_MINUTES = Math.max(
  10,
  estimateReadingMinutes(BLOG_LOAD_SENSING_PEMT.content),
);

import { randomUUID } from 'node:crypto';

import {
  aplicarExtraidas,
  assinaturaConfere,
  baixaConfiancaOcr,
  consentimentosVigentes,
  contemRanking,
  dadosCurriculoValidos,
  emailAnonimizado,
  interpretarLinkedinUrl,
  interpretarWhatsapp,
  lerDadosCurriculo,
  NOME_TITULAR_EXCLUIDO,
  normalizarHabilidades,
  perfilAposConfirmacao,
  substituirManuais,
  validarDeclaracaoArquivo,
  type DadosCurriculo,
  type ItemCatalogo,
  type TipoConsentimento,
} from '@scv/domain';
import type { Armazenamento, Antivirus } from '@scv/providers';

import type { Relogio } from '../auth/auth.service';
import { ErroAplicacao } from '../erros';
import type { FilaCurriculo } from '../fila/fila-curriculo';
import type { FilaMatch } from '../fila/fila-match';
import type {
  CurriculoRegistro,
  PerfilCandidato,
  Repositorio,
  SolicitacaoLgpdRegistro,
} from '../repositorio/tipos';

function semRanking(perfil: Record<string, unknown>): Record<string, unknown> {
  const saida: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(perfil)) {
    if (chave === 'score' || chave === 'embedding' || chave === 'posicao' || chave === 'percentil') continue;
    saida[chave] = valor;
  }
  return saida;
}

export class PerfilService {
  constructor(
    private readonly repo: Repositorio,
    private readonly filaMatch: FilaMatch,
  ) {}

  async obter(usuarioId: string) {
    return this.dto(await this.exigir(usuarioId));
  }

  async atualizar(
    usuarioId: string,
    entrada: {
      nome?: string;
      whatsapp?: string | null;
      linkedinUrl?: string | null;
      visivelParaMatch?: boolean;
      perfil?: Record<string, unknown>;
    },
  ) {
    const atual = await this.exigir(usuarioId);
    const linkedin =
      entrada.linkedinUrl !== undefined ? interpretarLinkedinUrl(entrada.linkedinUrl) : { ok: true as const, url: atual.linkedinUrl };
    if (!linkedin.ok) throw new ErroAplicacao(linkedin.codigo, 400, 'URL do LinkedIn inválida');
    const whatsapp =
      entrada.whatsapp !== undefined ? interpretarWhatsapp(entrada.whatsapp) : { ok: true as const, numero: atual.whatsapp };
    if (!whatsapp.ok) throw new ErroAplicacao(whatsapp.codigo, 400, 'WhatsApp inválido');
    const whatsappMudou = entrada.whatsapp !== undefined && whatsapp.numero !== atual.whatsapp;
    const salvo = await this.repo.salvarPerfil({
      ...atual,
      nome: entrada.nome?.trim() || atual.nome,
      whatsapp: entrada.whatsapp !== undefined ? whatsapp.numero : atual.whatsapp,
      whatsappVerificado: whatsappMudou ? false : atual.whatsappVerificado,
      linkedinUrl: entrada.linkedinUrl !== undefined ? linkedin.url : atual.linkedinUrl,
      visivelParaMatch: entrada.visivelParaMatch ?? atual.visivelParaMatch,
      perfil: semRanking({ ...atual.perfil, ...(entrada.perfil ?? {}) }),
    });
    const entrouNoMatch = salvo.visivelParaMatch && !atual.visivelParaMatch;
    if (entrouNoMatch || (salvo.visivelParaMatch && entrada.perfil)) await this.filaMatch.enfileirarEmbeddingCandidato(salvo.id);
    return this.dto(salvo);
  }

  async listarHabilidades(usuarioId: string) {
    const perfil = await this.exigir(usuarioId);
    const [catalogo, selecionadas] = await Promise.all([
      this.repo.listarCatalogoHabilidades(),
      this.repo.listarHabilidades(perfil.id),
    ]);
    return { catalogo, selecionadas };
  }

  async substituirHabilidades(
    usuarioId: string,
    itens: { habilidadeId: string; nivel: number; anosExperiencia?: number | null }[],
  ) {
    const perfil = await this.exigir(usuarioId);
    const catalogo = await this.repo.listarCatalogoHabilidades();
    const ids = new Set(catalogo.map((item) => item.id));
    if (itens.some((item) => !ids.has(item.habilidadeId))) {
      throw new ErroAplicacao('HABILIDADE_INVALIDA', 400, 'habilidade fora do catálogo');
    }
    const atuais = await this.repo.listarLinhasHabilidade(perfil.id);
    const proximas = substituirManuais(
      atuais,
      itens.map((item) => ({
        habilidadeId: item.habilidadeId,
        nivel: item.nivel,
        anosExperiencia: item.anosExperiencia ?? null,
        origem: 'MANUAL' as const,
      })),
    );
    await this.repo.definirHabilidades(perfil.id, proximas);
    if (perfil.visivelParaMatch) await this.filaMatch.enfileirarEmbeddingCandidato(perfil.id);
    return this.listarHabilidades(usuarioId);
  }

  private async exigir(usuarioId: string): Promise<PerfilCandidato> {
    const perfil = await this.repo.obterPerfil(usuarioId);
    if (!perfil) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'perfil não encontrado');
    return perfil;
  }

  private dto(perfil: PerfilCandidato) {
    return {
      id: perfil.id,
      nome: perfil.nome,
      whatsapp: perfil.whatsapp,
      whatsappVerificado: perfil.whatsappVerificado,
      linkedinUrl: perfil.linkedinUrl,
      visivelParaMatch: perfil.visivelParaMatch,
      perfil: perfil.perfil,
    };
  }
}

export class CurriculoService {
  constructor(
    private readonly repo: Repositorio,
    private readonly armazenamento: Armazenamento,
    private readonly antivirus: Antivirus,
    private readonly fila: FilaCurriculo,
    private readonly relogio: Relogio,
    private readonly filaMatch: FilaMatch,
  ) {}

  async criarUpload(usuarioId: string, mimeType: string, tamanhoBytes: number, baseApi: string) {
    const declaracao = validarDeclaracaoArquivo(mimeType, tamanhoBytes);
    if (!declaracao.ok) throw new ErroAplicacao(declaracao.codigo, 400, 'arquivo inválido');
    const perfil = await this.exigirPerfil(usuarioId);
    const arquivoKey = `curriculos/${perfil.id}/${randomUUID()}`;
    const url = await this.armazenamento.criarUrlUpload({
      key: arquivoKey,
      mimeType: declaracao.mimeType,
      tamanhoBytes: declaracao.tamanhoBytes,
      baseApi,
    });
    return { arquivoKey, url: url.url, headers: url.headers, expiraEmSegundos: 900 };
  }

  async registrar(usuarioId: string, arquivoKey: string, mimeType: string, tamanhoBytes: number) {
    const declaracao = validarDeclaracaoArquivo(mimeType, tamanhoBytes);
    if (!declaracao.ok) throw new ErroAplicacao(declaracao.codigo, 400, 'arquivo inválido');
    const perfil = await this.exigirPerfil(usuarioId);
    if (!arquivoKey.startsWith(`curriculos/${perfil.id}/`)) {
      throw new ErroAplicacao('ARQUIVO_INVALIDO', 400, 'arquivo inválido');
    }
    const existente = await this.repo.buscarCurriculoPorKey(arquivoKey);
    if (existente?.candidatoId === perfil.id) return this.dto(existente);
    const corpo = await this.armazenamento.ler(arquivoKey);
    if (!corpo) throw new ErroAplicacao('ARQUIVO_AUSENTE', 400, 'arquivo ausente');
    if (corpo.length !== declaracao.tamanhoBytes) throw new ErroAplicacao('TAMANHO_INVALIDO', 400, 'tamanho divergente');
    if (!assinaturaConfere(corpo, declaracao.mimeType)) throw new ErroAplicacao('TIPO_INVALIDO', 400, 'tipo divergente');
    if ((await this.antivirus.escanear(corpo)) === 'INFECTADO') {
      await this.armazenamento.apagar(arquivoKey);
      throw new ErroAplicacao('ARQUIVO_INFECTADO', 422, 'arquivo recusado pelo antivírus');
    }
    const curriculo = await this.repo.criarCurriculo({
      id: randomUUID(),
      candidatoId: perfil.id,
      arquivoKey,
      mimeType: declaracao.mimeType,
      tamanhoBytes: declaracao.tamanhoBytes,
      antivirusStatus: 'LIMPO',
      metodoExtracao: null,
      statusProcessamento: 'PENDENTE',
      confiancaOcr: null,
      textoExtraido: null,
      dadosExtraidos: null,
      confirmadoEm: null,
      aplicadoAoPerfil: false,
      paginas: null,
      criadoEm: this.relogio.agora(),
    });
    await this.fila.enfileirar(curriculo.id);
    return this.dto(curriculo);
  }

  async listar(usuarioId: string) {
    const perfil = await this.exigirPerfil(usuarioId);
    const itens = await this.repo.listarCurriculos(perfil.id);
    return itens.map((item) => this.resumo(item));
  }

  async obter(usuarioId: string, id: string) {
    const perfil = await this.exigirPerfil(usuarioId);
    const curriculo = await this.repo.buscarCurriculo(id);
    if (!curriculo || curriculo.candidatoId !== perfil.id) {
      throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'currículo não encontrado');
    }
    return this.dto(curriculo);
  }

  async confirmar(usuarioId: string, id: string, dadosInformados?: DadosCurriculo) {
    const perfil = await this.exigirPerfil(usuarioId);
    const curriculo = await this.repo.buscarCurriculo(id);
    if (!curriculo || curriculo.candidatoId !== perfil.id) {
      throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'currículo não encontrado');
    }
    if (curriculo.statusProcessamento !== 'CONCLUIDO') {
      throw new ErroAplicacao('PROCESSAMENTO_PENDENTE', 409, 'currículo ainda não foi processado');
    }
    const dados = dadosInformados ?? lerDadosCurriculo(curriculo.dadosExtraidos);
    const catalogo = await this.catalogo();
    const normalizadas = normalizarHabilidades(dados.habilidades, catalogo);
    const atuais = await this.repo.listarLinhasHabilidade(perfil.id);
    await this.repo.definirHabilidades(
      perfil.id,
      aplicarExtraidas(
        atuais,
        normalizadas.mapeadas.map((item) => ({
          habilidadeId: item.habilidadeId,
          nivel: item.nivel,
          anosExperiencia: null,
          origem: 'CV_EXTRAIDO' as const,
        })),
      ),
    );
    await this.repo.salvarPerfil({ ...perfil, perfil: perfilAposConfirmacao(perfil.perfil, dados) });
    const atualizado = await this.repo.atualizarCurriculo(curriculo.id, {
      confirmadoEm: this.relogio.agora(),
      aplicadoAoPerfil: true,
      dadosExtraidos: {
        ...dados,
        habilidadesMapeadas: normalizadas.mapeadas,
        habilidadesNaoMapeadas: normalizadas.naoMapeadas,
      },
    });
    if (perfil.visivelParaMatch) await this.filaMatch.enfileirarEmbeddingCandidato(perfil.id);
    return this.dto(atualizado);
  }

  async metaInterna(id: string) {
    const curriculo = await this.repo.buscarCurriculo(id);
    if (!curriculo) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'currículo não encontrado');
    if (curriculo.statusProcessamento !== 'CONCLUIDO') {
      await this.repo.atualizarCurriculo(id, { statusProcessamento: 'PROCESSANDO' });
    }
    return {
      arquivoKey: curriculo.arquivoKey,
      mimeType: curriculo.mimeType,
      statusProcessamento: curriculo.statusProcessamento,
      catalogo: await this.catalogo(),
    };
  }

  async salvarResultado(
    id: string,
    resultado: {
      metodoExtracao: CurriculoRegistro['metodoExtracao'];
      confiancaOcr: number | null;
      textoExtraido: string;
      dados: DadosCurriculo;
      paginas: unknown;
    },
  ) {
    const curriculo = await this.repo.buscarCurriculo(id);
    if (!curriculo) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'currículo não encontrado');
    if (curriculo.statusProcessamento === 'CONCLUIDO' || curriculo.aplicadoAoPerfil) return this.dto(curriculo);
    if (!dadosCurriculoValidos(resultado.dados) || !resultado.metodoExtracao) {
      throw new ErroAplicacao('DADOS_INVALIDOS', 400, 'dados inválidos');
    }
    const catalogo = await this.catalogo();
    const normalizadas = normalizarHabilidades(resultado.dados.habilidades, catalogo);
    const atualizado = await this.repo.atualizarCurriculo(id, {
      metodoExtracao: resultado.metodoExtracao,
      confiancaOcr: resultado.confiancaOcr,
      textoExtraido: resultado.textoExtraido,
      paginas: resultado.paginas,
      statusProcessamento: 'CONCLUIDO',
      dadosExtraidos: {
        ...resultado.dados,
        habilidadesMapeadas: normalizadas.mapeadas,
        habilidadesNaoMapeadas: normalizadas.naoMapeadas,
      },
    });
    return this.dto(atualizado);
  }

  async marcarFalha(id: string) {
    const curriculo = await this.repo.buscarCurriculo(id);
    if (!curriculo || curriculo.statusProcessamento === 'CONCLUIDO') return;
    await this.repo.atualizarCurriculo(id, { statusProcessamento: 'FALHA' });
  }

  private async catalogo(): Promise<ItemCatalogo[]> {
    return this.repo.listarCatalogoHabilidades();
  }

  private async exigirPerfil(usuarioId: string): Promise<PerfilCandidato> {
    const perfil = await this.repo.obterPerfil(usuarioId);
    if (!perfil) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'perfil não encontrado');
    return perfil;
  }

  private resumo(curriculo: CurriculoRegistro) {
    return {
      id: curriculo.id,
      statusProcessamento: curriculo.statusProcessamento,
      metodoExtracao: curriculo.metodoExtracao,
      baixaConfianca: baixaConfiancaOcr(curriculo.metodoExtracao, curriculo.confiancaOcr),
      aplicadoAoPerfil: curriculo.aplicadoAoPerfil,
      criadoEm: curriculo.criadoEm.toISOString(),
    };
  }

  private dto(curriculo: CurriculoRegistro) {
    return {
      ...this.resumo(curriculo),
      mimeType: curriculo.mimeType,
      tamanhoBytes: curriculo.tamanhoBytes,
      confiancaOcr: curriculo.confiancaOcr,
      textoExtraido: curriculo.textoExtraido,
      dadosExtraidos: curriculo.dadosExtraidos,
      confirmadoEm: curriculo.confirmadoEm?.toISOString() ?? null,
    };
  }
}

export class ConsentimentoService {
  constructor(
    private readonly repo: Repositorio,
    private readonly relogio: Relogio,
  ) {}

  async listar(usuarioId: string) {
    const perfil = await this.repo.obterPerfil(usuarioId);
    if (!perfil) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'perfil não encontrado');
    const registros = await this.repo.listarConsentimentos(perfil.id);
    return consentimentosVigentes(registros).map((item) => ({
      tipo: item.tipo,
      concedido: item.concedido,
      versaoTermo: item.versaoTermo,
      criadoEm: item.criadoEm.toISOString(),
    }));
  }

  async registrar(usuarioId: string, entrada: { tipo: TipoConsentimento; concedido: boolean; versaoTermo: string }) {
    const perfil = await this.repo.obterPerfil(usuarioId);
    if (!perfil) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'perfil não encontrado');
    const registro = await this.repo.registrarConsentimento({
      id: randomUUID(),
      candidatoId: perfil.id,
      tipo: entrada.tipo,
      concedido: entrada.concedido,
      versaoTermo: entrada.versaoTermo,
      criadoEm: this.relogio.agora(),
    });
    return {
      tipo: registro.tipo,
      concedido: registro.concedido,
      versaoTermo: registro.versaoTermo,
      criadoEm: registro.criadoEm.toISOString(),
    };
  }
}

export class LgpdService {
  constructor(
    private readonly repo: Repositorio,
    private readonly armazenamento: Armazenamento,
    private readonly relogio: Relogio,
  ) {}

  async exportar(usuarioId: string) {
    const perfil = await this.repo.obterPerfil(usuarioId);
    if (!perfil) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'perfil não encontrado');
    const [habilidades, curriculos, consentimentos] = await Promise.all([
      this.repo.listarHabilidades(perfil.id),
      this.repo.listarCurriculos(perfil.id),
      this.repo.listarConsentimentos(perfil.id),
    ]);
    const pacote = {
      perfil: {
        nome: perfil.nome,
        whatsapp: perfil.whatsapp,
        linkedinUrl: perfil.linkedinUrl,
        visivelParaMatch: perfil.visivelParaMatch,
        dados: perfil.perfil,
      },
      habilidades: habilidades.map((item) => ({
        nome: item.nome,
        nivel: item.nivel,
        anosExperiencia: item.anosExperiencia,
        origem: item.origem,
      })),
      curriculos: curriculos.map((item) => ({
        id: item.id,
        mimeType: item.mimeType,
        statusProcessamento: item.statusProcessamento,
        metodoExtracao: item.metodoExtracao,
        textoExtraido: item.textoExtraido,
        dadosExtraidos: item.dadosExtraidos,
      })),
      consentimentos: consentimentosVigentes(consentimentos).map((item) => ({
        tipo: item.tipo,
        concedido: item.concedido,
        versaoTermo: item.versaoTermo,
        criadoEm: item.criadoEm.toISOString(),
      })),
    };
    if (contemRanking(pacote)) throw new ErroAplicacao('ERRO_INTERNO', 500, 'erro interno');
    await this.registrar(usuarioId, perfil.id, 'EXPORTACAO');
    return pacote;
  }

  async excluir(usuarioId: string) {
    const perfil = await this.repo.obterPerfil(usuarioId);
    if (!perfil) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'perfil não encontrado');
    await this.registrar(usuarioId, perfil.id, 'EXCLUSAO');
    const { arquivoKeys } = await this.repo.expurgarDadosCandidato(usuarioId, {
      email: emailAnonimizado(usuarioId),
      senhaHash: 'expurgado',
      nome: NOME_TITULAR_EXCLUIDO,
    });
    for (const key of arquivoKeys) await this.armazenamento.apagar(key);
    return { ok: true };
  }

  private async registrar(usuarioId: string, candidatoId: string, tipo: SolicitacaoLgpdRegistro['tipo']) {
    await this.repo.registrarSolicitacaoLgpd({
      id: randomUUID(),
      usuarioId,
      candidatoId,
      tipo,
      criadoEm: this.relogio.agora(),
    });
  }
}

import sharp from 'sharp';

export async function preprocessarImagem(imagem: Buffer): Promise<{ buffer: Buffer; etapas: string[] }> {
  const cinza = await sharp(imagem, { failOn: 'none' }).rotate().grayscale().normalise().png().toBuffer();
  const binarizada = await sharp(cinza).threshold(170).png().toBuffer();
  const angulo = await estimarInclinacao(binarizada);
  const saida =
    angulo === 0
      ? binarizada
      : await sharp(binarizada).rotate(angulo, { background: { r: 255, g: 255, b: 255 } }).png().toBuffer();
  return { buffer: saida, etapas: ['escala-cinza', 'binarizacao', 'deskew'] };
}

async function estimarInclinacao(png: Buffer): Promise<number> {
  let melhor = 0;
  let melhorVariancia = -1;
  for (const angulo of [-4, -2, 0, 2, 4]) {
    const { data, info } = await sharp(png)
      .rotate(angulo, { background: { r: 255, g: 255, b: 255 } })
      .resize({ width: 160, withoutEnlargement: true })
      .raw()
      .toBuffer({ resolveWithObject: true });
    const variancia = varianciaHorizontal(data, info.width, info.height, info.channels);
    if (variancia > melhorVariancia) {
      melhorVariancia = variancia;
      melhor = angulo;
    }
  }
  return melhor;
}

function varianciaHorizontal(data: Buffer, largura: number, altura: number, canais: number): number {
  const totais: number[] = [];
  for (let y = 0; y < altura; y += 1) {
    let soma = 0;
    for (let x = 0; x < largura; x += 1) {
      if (data[(y * largura + x) * canais] < 128) soma += 1;
    }
    totais.push(soma);
  }
  if (totais.length === 0) return 0;
  const media = totais.reduce((total, valor) => total + valor, 0) / totais.length;
  return totais.reduce((total, valor) => total + (valor - media) ** 2, 0) / totais.length;
}

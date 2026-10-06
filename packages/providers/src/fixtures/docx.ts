export function zipArmazenado(arquivos: { nome: string; dados: Buffer }[]): Buffer {
  const locais: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const arquivo of arquivos) {
    const nome = Buffer.from(arquivo.nome);
    const crc = crc32(arquivo.dados);
    const cabecalho = Buffer.alloc(30);
    cabecalho.writeUInt32LE(0x04034b50, 0);
    cabecalho.writeUInt16LE(20, 4);
    cabecalho.writeUInt32LE(crc, 14);
    cabecalho.writeUInt32LE(arquivo.dados.length, 18);
    cabecalho.writeUInt32LE(arquivo.dados.length, 22);
    cabecalho.writeUInt16LE(nome.length, 26);
    locais.push(cabecalho, nome, arquivo.dados);
    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(20, 4);
    dir.writeUInt16LE(20, 6);
    dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(arquivo.dados.length, 20);
    dir.writeUInt32LE(arquivo.dados.length, 24);
    dir.writeUInt16LE(nome.length, 28);
    dir.writeUInt32LE(offset, 42);
    central.push(dir, nome);
    offset += cabecalho.length + nome.length + arquivo.dados.length;
  }
  const diretorio = Buffer.concat(central);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(arquivos.length, 8);
  fim.writeUInt16LE(arquivos.length, 10);
  fim.writeUInt32LE(diretorio.length, 12);
  fim.writeUInt32LE(offset, 16);
  return Buffer.concat([...locais, diretorio, fim]);
}

function crc32(dados: Buffer): number {
  let crc = ~0;
  for (const byte of dados) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

export function docxComTexto(texto: string): Buffer {
  const seguro = texto.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const documento = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t xml:space="preserve">${seguro}</w:t></w:r></w:p></w:body></w:document>`;
  const tipos = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  return zipArmazenado([
    { nome: '[Content_Types].xml', dados: Buffer.from(tipos) },
    { nome: '_rels/.rels', dados: Buffer.from(rels) },
    { nome: 'word/document.xml', dados: Buffer.from(documento) },
  ]);
}

/**
 * Reduz a foto da nota antes de enviar: foto de celular tem vários MB, e para ler
 * uma nota 1600 px de lado maior já é de sobra. Se algo falhar, devolve a original.
 */
export async function reduzirImagem(arquivo: File, maxLado = 1600, qualidade = 0.82): Promise<Blob> {
  try {
    if (!arquivo.type.startsWith("image/")) return arquivo;
    const bmp = await createImageBitmap(arquivo);
    const escala = Math.min(1, maxLado / Math.max(bmp.width, bmp.height));
    const largura = Math.max(1, Math.round(bmp.width * escala));
    const altura = Math.max(1, Math.round(bmp.height * escala));
    const tela = document.createElement("canvas");
    tela.width = largura;
    tela.height = altura;
    const ctx = tela.getContext("2d");
    if (!ctx) return arquivo;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, largura, altura);
    ctx.drawImage(bmp, 0, 0, largura, altura);
    bmp.close?.();
    const blob = await new Promise<Blob | null>((ok) => tela.toBlob(ok, "image/jpeg", qualidade));
    return blob && blob.size < arquivo.size ? blob : blob && escala < 1 ? blob : arquivo;
  } catch {
    return arquivo;
  }
}

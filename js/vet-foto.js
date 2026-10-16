// Pet Natureza - Consulta Veterinária
// Fotos opcionais (até 2): reduz no navegador (lado maior até 1280 px, JPEG),
// remove EXIF (ao redesenhar no canvas), prévia e envio ao bucket privado vet-fotos.

const MAX_FOTOS = 2;
const LADO_MAX = 1280;
const LIMITE_BYTES = 2 * 1024 * 1024;
const ORIGINAL_MAX = 30 * 1024 * 1024;
const BUCKET = 'vet-fotos';
const $ = (id) => document.getElementById(id);

async function abrirImagem(arquivo) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
      return {
        fonte: bmp,
        largura: bmp.width,
        altura: bmp.height,
        liberar: () => { if (bmp.close) bmp.close(); }
      };
    } catch (e) {
      /* tenta pelo elemento img */
    }
  }
  const url = URL.createObjectURL(arquivo);
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise((ok, falha) => {
      img.onload = ok;
      img.onerror = () => falha(new Error('decode'));
      img.src = url;
    });
    return {
      fonte: img,
      largura: img.naturalWidth,
      altura: img.naturalHeight,
      liberar: () => URL.revokeObjectURL(url)
    };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

const paraBlob = (canvas, qualidade) =>
  new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', qualidade));

async function reduzir(arquivo) {
  const img = await abrirImagem(arquivo);
  try {
    if (!img.largura || !img.altura) throw new Error('vazia');
    const maior = Math.max(img.largura, img.altura);
    const escala = maior > LADO_MAX ? LADO_MAX / maior : 1;
    const w = Math.max(1, Math.round(img.largura * escala));
    const h = Math.max(1, Math.round(img.altura * escala));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img.fonte, 0, 0, w, h);
    for (const q of [0.85, 0.7, 0.55]) {
      const blob = await paraBlob(canvas, q);
      if (blob && blob.size > 0 && blob.size <= LIMITE_BYTES) return blob;
    }
    throw new Error('grande');
  } finally {
    img.liberar();
  }
}

const duplicado = (e) =>
  /already exists|duplicate/i.test(String((e && e.message) || ''))
  || String((e && (e.statusCode || e.status)) || '') === '409';

export function criarFotos({ aoMudar }) {
  const entrada = $('f-fotos');
  const lista = $('vt-fotos-lista');
  const status = $('vt-fotos-status');
  const erro = $('erro-fotos');
  const itens = []; // { blob, url }
  let ocupado = false;

  function mostrarErro(msg) {
    erro.textContent = msg || '';
    erro.hidden = !msg;
  }

  function renderizar() {
    lista.innerHTML = itens.map((f, i) =>
      '<div class="vt-foto-previa"><img src="' + f.url + '" alt="Prévia da foto ' + (i + 1) +
      '" width="112" height="112"><button type="button" class="vt-foto-remover" data-i="' + i +
      '" aria-label="Remover foto ' + (i + 1) + '">✕</button></div>'
    ).join('');
  }

  entrada.addEventListener('change', async () => {
    const arquivos = Array.from(entrada.files || []);
    entrada.value = '';
    if (ocupado || !arquivos.length) return;
    mostrarErro('');

    const livres = MAX_FOTOS - itens.length;
    if (livres <= 0) {
      mostrarErro('Você já adicionou 2 fotos. Remova uma para adicionar outra.');
      return;
    }

    ocupado = true;
    let adicionadas = 0;
    const problemas = [];
    if (arquivos.length > livres) {
      problemas.push('Só cabem ' + MAX_FOTOS + ' fotos. Usamos as primeiras escolhidas.');
    }
    try {
      for (const arq of arquivos.slice(0, livres)) {
        status.textContent = 'Preparando foto…';
        if (!/^image\//.test(arq.type) && arq.type !== '') {
          problemas.push('"' + arq.name + '" não é uma imagem.');
          continue;
        }
        if (arq.size > ORIGINAL_MAX) {
          problemas.push('"' + arq.name + '" é muito grande. Escolha uma foto menor.');
          continue;
        }
        try {
          const blob = await reduzir(arq);
          itens.push({ blob, url: URL.createObjectURL(blob) });
          adicionadas += 1;
        } catch (e) {
          problemas.push('Não foi possível usar "' + arq.name + '". Tente outra foto (JPG, PNG ou WEBP).');
        }
      }
    } finally {
      ocupado = false;
      renderizar();
      status.textContent = adicionadas
        ? adicionadas + (adicionadas === 1 ? ' foto adicionada.' : ' fotos adicionadas.')
        : '';
      mostrarErro(problemas.join(' '));
      aoMudar();
    }
  });

  lista.addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-i]');
    if (!b) return;
    const i = Number(b.getAttribute('data-i'));
    const f = itens[i];
    if (!f) return;
    URL.revokeObjectURL(f.url);
    itens.splice(i, 1);
    renderizar();
    mostrarErro('');
    status.textContent = 'Foto removida.';
    entrada.focus();
    aoMudar();
  });

  // Envia para vet-fotos/<id>/foto1.jpg e foto2.jpg ANTES do RPC.
  // Falha de uma foto não impede as demais; "já existe" (reenvio) conta como sucesso.
  async function enviar(client, id) {
    const caminhos = [];
    let falhou = 0;
    for (let i = 0; i < itens.length; i += 1) {
      const caminho = id + '/foto' + (i + 1) + '.jpg';
      try {
        const { error } = await client.storage.from(BUCKET).upload(caminho, itens[i].blob, {
          contentType: 'image/jpeg',
          upsert: false,
          cacheControl: '3600'
        });
        if (!error || duplicado(error)) caminhos.push(caminho);
        else falhou += 1;
      } catch (e) {
        falhou += 1;
      }
    }
    return { caminhos, falhou };
  }

  function limpar() {
    itens.forEach((f) => URL.revokeObjectURL(f.url));
    itens.splice(0, itens.length);
    renderizar();
    mostrarErro('');
    status.textContent = '';
  }

  return {
    enviar,
    limpar,
    previas: () => itens.map((f) => f.url),
    quantidade: () => itens.length
  };
}

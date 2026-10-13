// PET NATUREZA - Banho & Tosa (site) - foto do pet (reduz no navegador)
// Ao redesenhar no canvas, a foto é salva sem os dados EXIF (local, câmera etc.).
import { $ } from './banho-util.js';

const TIPOS = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_ORIGINAL = 15 * 1024 * 1024;
const MAX_FINAL = 1900000;

export function reduzirFoto(arquivo, ladoMax = 1280, qualidade = 0.85) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (!w || !h) {
        reject(new Error('imagem vazia'));
        return;
      }
      const escala = Math.min(1, ladoMax / Math.max(w, h));
      w = Math.max(1, Math.round(w * escala));
      h = Math.max(1, Math.round(h * escala));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('sem canvas'));
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('falha ao converter'));
          return;
        }
        if (blob.size > MAX_FINAL && qualidade > 0.6) {
          resolve(reduzirFoto(arquivo, 1024, 0.6));
        } else if (blob.size > MAX_FINAL) {
          reject(new Error('foto grande demais'));
        } else {
          resolve(blob);
        }
      }, 'image/jpeg', qualidade);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('não foi possível ler'));
    };
    img.src = url;
  });
}

// estado: objeto compartilhado com banho.js (foto, fotoUrl, fotoEnviada, fotoFalhou)
export function ligarFoto(estado) {
  const input = $('f-foto');
  const previa = $('bt-foto-previa');
  const img = $('bt-foto-img');
  const erro = $('erro-foto');
  const remover = $('bt-foto-remover');
  let ticket = 0;

  function limpar() {
    ticket += 1;
    if (estado.fotoUrl) URL.revokeObjectURL(estado.fotoUrl);
    estado.foto = null;
    estado.fotoUrl = '';
    estado.fotoEnviada = false;
    estado.fotoFalhou = false;
    img.removeAttribute('src');
    previa.hidden = true;
  }

  // setTimeout: o aviso aparece depois que o evento termina de subir pelo formulário
  function falha(texto) {
    input.value = '';
    setTimeout(() => {
      erro.textContent = texto;
      erro.hidden = false;
      input.setAttribute('aria-invalid', 'true');
    }, 0);
  }

  input.addEventListener('change', async () => {
    const arquivo = input.files && input.files[0];
    limpar();
    if (!arquivo) return;
    const meu = ticket;
    if (!TIPOS.includes(arquivo.type)) {
      falha('Use uma foto nos formatos JPG, PNG ou WebP.');
      return;
    }
    if (arquivo.size > MAX_ORIGINAL) {
      falha('A foto é muito grande. Use uma foto de até 15 MB.');
      return;
    }
    try {
      const blob = await reduzirFoto(arquivo);
      if (meu !== ticket) return;
      estado.foto = blob;
      estado.fotoUrl = URL.createObjectURL(blob);
      img.src = estado.fotoUrl;
      previa.hidden = false;
    } catch (e) {
      if (meu === ticket) falha('Não foi possível ler esta foto. Tente outra imagem.');
    }
  });

  remover.addEventListener('click', () => {
    limpar();
    input.value = '';
    input.focus();
  });

  return { limpar };
}

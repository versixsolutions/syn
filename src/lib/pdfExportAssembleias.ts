import { jsPDF } from 'jspdf';
import { supabase } from './supabase';
import type { Assembleia, AssembleiaPauta, ResultadoVotacao } from '../types';

/**
 * Exporta os resultados de uma assembleia para PDF
 */
export async function exportarResultadosAssembleiaPDF(assembleiaId: string) {
  try {
    // Carregar dados da assembleia
    const { data: assembleia, error: assembleiaError } = await supabase
      .from('assembleias')
      .select('*')
      .eq('id', assembleiaId)
      .single();

    if (assembleiaError) throw assembleiaError;
    if (!assembleia) throw new Error('Assembleia não encontrada');

    // Carregar pautas
    const { data: pautas, error: pautasError } = await supabase
      .from('assembleias_pautas')
      .select('*')
      .eq('assembleia_id', assembleiaId)
      .order('ordem');

    if (pautasError) throw pautasError;

    // Carregar votos de cada pauta
    const pautasComResultados: Array<AssembleiaPauta & { resultado: ResultadoVotacao }> = [];

    for (const pauta of pautas || []) {
      const { data: votos } = await supabase
        .from('assembleias_votos')
        .select('voto')
        .eq('pauta_id', pauta.id);

      const totalVotos = votos?.length || 0;
      const contagem: Record<string, number> = {};

      votos?.forEach((v) => {
        contagem[v.voto] = (contagem[v.voto] || 0) + 1;
      });

      const resultado: ResultadoVotacao = {
        pauta_id: pauta.id,
        titulo: pauta.titulo,
        total_votos: totalVotos,
        resultados: pauta.opcoes.map((opcao) => ({
          opcao,
          votos: contagem[opcao] || 0,
          percentual: totalVotos > 0 ? ((contagem[opcao] || 0) / totalVotos) * 100 : 0,
        })),
        vencedor: null,
      };

      // Determinar vencedor
      if (resultado.resultados.length > 0) {
        const max = Math.max(...resultado.resultados.map((o) => o.votos));
        const vencedoras = resultado.resultados.filter((o) => o.votos === max);
        if (vencedoras.length === 1) {
          resultado.vencedor = vencedoras[0].opcao;
        }
      }

      pautasComResultados.push({ ...pauta, resultado });
    }

    // Gerar PDF
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let y = margin;

    // Helper para adicionar nova página se necessário
    const checkPageBreak = (neededSpace: number) => {
      if (y + neededSpace > pageHeight - margin) {
        doc.addPage();
        y = margin;
        return true;
      }
      return false;
    };

    // Cabeçalho
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Resultados da Assembleia', pageWidth / 2, y, { align: 'center' });
    y += 10;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(assembleia.titulo, pageWidth / 2, y, { align: 'center' });
    y += 6;

    doc.setFontSize(10);
    doc.setTextColor(100);
    const dataFormatada = new Date(assembleia.data_hora).toLocaleString('pt-BR', {
      dateStyle: 'long',
      timeStyle: 'short',
    });
    doc.text(dataFormatada, pageWidth / 2, y, { align: 'center' });
    y += 12;

    // Linha separadora
    doc.setDrawColor(200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    // Listar cada pauta e seus resultados
    for (let i = 0; i < pautasComResultados.length; i++) {
      const pauta = pautasComResultados[i];

      checkPageBreak(50);

      // Título da pauta
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0);
      doc.text(`${i + 1}. ${pauta.titulo}`, margin, y);
      y += 7;

      // Descrição
      if (pauta.descricao) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60);
        const lines = doc.splitTextToSize(pauta.descricao, pageWidth - 2 * margin);
        lines.forEach((line: string) => {
          checkPageBreak(5);
          doc.text(line, margin, y);
          y += 5;
        });
        y += 2;
      }

      // Total de votos
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100);
      doc.text(`Total de votos: ${pauta.resultado.total_votos}`, margin, y);
      y += 8;

      // Resultados
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0);

      pauta.resultado.resultados.forEach((opcao) => {
        checkPageBreak(15);

        const isVencedor = opcao.opcao === pauta.resultado.vencedor;

        // Nome da opção
        doc.setFontSize(11);
        if (isVencedor) {
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(0, 128, 0); // Verde para vencedor
        } else {
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0);
        }

        const opcaoText = isVencedor ? `✓ ${opcao.opcao}` : opcao.opcao;
        doc.text(opcaoText, margin + 5, y);

        // Barra de progresso visual
        const barWidth = 80;
        const barHeight = 8;
        const barX = margin + 5;
        const barY = y + 2;

        // Fundo da barra
        doc.setFillColor(240);
        doc.rect(barX, barY, barWidth, barHeight, 'F');

        // Barra de progresso
        const fillWidth = (opcao.percentual / 100) * barWidth;
        if (isVencedor) {
          doc.setFillColor(34, 197, 94); // Verde
        } else {
          doc.setFillColor(147, 51, 234); // Roxo
        }
        doc.rect(barX, barY, fillWidth, barHeight, 'F');

        // Percentual e contagem
        doc.setFontSize(10);
        doc.setTextColor(0);
        const resultText = `${opcao.votos} votos (${opcao.percentual.toFixed(1)}%)`;
        doc.text(resultText, barX + barWidth + 5, y + 6);

        y += 14;
      });

      y += 5;

      // Linha separadora entre pautas
      if (i < pautasComResultados.length - 1) {
        checkPageBreak(5);
        doc.setDrawColor(220);
        doc.line(margin, y, pageWidth - margin, y);
        y += 10;
      }
    }

    // Rodapé
    y = pageHeight - margin;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(150);
    const rodape = `Documento gerado em ${new Date().toLocaleString('pt-BR')}`;
    doc.text(rodape, pageWidth / 2, y, { align: 'center' });

    // Salvar PDF
    const filename = `assembleia_${assembleia.titulo
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')}_${new Date().toISOString().split('T')[0]}.pdf`;
    
    doc.save(filename);

    return { success: true };
  } catch (error) {
    console.error('Erro ao exportar PDF:', error);
    return { success: false, error };
  }
}

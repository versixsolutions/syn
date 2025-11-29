import { useEffect, useMemo, useState } from 'react'
import PageLayout from '../../components/PageLayout'
import { QRCodeCanvas } from 'qrcode.react'
import { useAssembleias } from '../../hooks/useAssembleias'
import { useAuth } from '../../contexts/AuthContext'
import type { Assembleia, AssembleiaPauta } from '../../types'
import LoadingSpinner from '../../components/LoadingSpinner'

export default function AdminAssembleias() {
  const { canManage, profile } = useAuth()
  const {
    assembleias,
    loading,
    reload,
    createAssembleia,
    updateAssembleia,
    deleteAssembleia,
    setStatusAssembleia,
    loadPautas,
    addPauta,
    updatePauta,
    deletePauta,
    abrirVotacao,
    encerrarVotacao,
  } = useAssembleias()

  const [selected, setSelected] = useState<Assembleia | null>(null)
  const [pautas, setPautas] = useState<AssembleiaPauta[]>([])

  // Form state for new/edit assembleia
  const [newAss, setNewAss] = useState({
    titulo: '',
    data_hora: '',
    edital_topicos_text: '', // textarea with one topic per line
    edital_pdf_file: null as File | null,
  })

  const [editAss, setEditAss] = useState({
    titulo: '',
    data_hora: '',
    edital_topicos_text: '',
    ata_topicos_text: '',
    edital_pdf_file: null as File | null,
    ata_pdf_file: null as File | null,
  })

  // Pauta form
  const [pautaForm, setPautaForm] = useState({
    titulo: '',
    descricao: '',
    ordem: 1,
    tipo_votacao: 'aberta' as 'aberta' | 'secreta',
    opcoes_text: 'Sim\nNão',
  })

  useEffect(() => {
    if (selected) {
      loadPautas(selected.id).then(setPautas)
      setEditAss({
        titulo: selected.titulo,
        data_hora: selected.data_hora.substring(0,16),
        edital_topicos_text: (selected.edital_topicos || []).join('\n'),
        ata_topicos_text: (selected.ata_topicos || []).join('\n'),
        edital_pdf_file: null,
        ata_pdf_file: null,
      })
    } else {
      setPautas([])
    }
  }, [selected, loadPautas])

  if (!canManage) return <div className="p-6">Acesso restrito.</div>

  async function handleCreate() {
    const edital_topicos = newAss.edital_topicos_text
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)

    const created = await createAssembleia({
      titulo: newAss.titulo,
      data_hora: newAss.data_hora,
      edital_topicos,
      edital_pdf_file: newAss.edital_pdf_file,
    })

    if (created) {
      setNewAss({ titulo: '', data_hora: '', edital_topicos_text: '', edital_pdf_file: null })
      setSelected(created)
      await reload()
    }
  }

  async function handleUpdate() {
    if (!selected) return

    const edital_topicos = editAss.edital_topicos_text.split('\n').map(s=>s.trim()).filter(Boolean)
    const ata_topicos = editAss.ata_topicos_text.split('\n').map(s=>s.trim()).filter(Boolean)

    await updateAssembleia(selected.id, {
      titulo: editAss.titulo,
      data_hora: editAss.data_hora,
      edital_topicos,
      ata_topicos,
      edital_pdf_file: editAss.edital_pdf_file,
      ata_pdf_file: editAss.ata_pdf_file,
    })

    await reload()
  }

  async function handleAddPauta() {
    if (!selected) return
    const opcoes = pautaForm.opcoes_text.split('\n').map(s=>s.trim()).filter(Boolean)
    const ok = await addPauta(selected.id, {
      assembleia_id: selected.id,
      titulo: pautaForm.titulo,
      descricao: pautaForm.descricao,
      ordem: pautaForm.ordem,
      tipo_votacao: pautaForm.tipo_votacao,
      opcoes,
    })
    if (ok) {
      setPautaForm({ titulo: '', descricao: '', ordem: 1, tipo_votacao: 'aberta', opcoes_text: 'Sim\nNão' })
      setPautas(await loadPautas(selected.id))
    }
  }

  return (
    <PageLayout title="Assembleias (Admin)" subtitle={profile?.condominio_id ? 'Gestão do condomínio' : ''} icon="🛠️">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna esquerda: lista e criação */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="font-bold text-gray-900 mb-3">Nova Assembleia</h3>
            <div className="space-y-3">
              <input className="w-full border rounded-lg px-3 py-2" placeholder="Título" value={newAss.titulo} onChange={e=>setNewAss(s=>({...s, titulo:e.target.value}))} />
              <input className="w-full border rounded-lg px-3 py-2" type="datetime-local" value={newAss.data_hora} onChange={e=>setNewAss(s=>({...s, data_hora:e.target.value}))} />
              <textarea className="w-full border rounded-lg px-3 py-2" rows={4} placeholder="Tópicos do edital (1 por linha)" value={newAss.edital_topicos_text} onChange={e=>setNewAss(s=>({...s, edital_topicos_text:e.target.value}))} />
              <input className="w-full" type="file" accept="application/pdf" onChange={e=>setNewAss(s=>({...s, edital_pdf_file: e.target.files?.[0] || null}))} />
              <button onClick={handleCreate} className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg font-bold">Criar</button>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="font-bold text-gray-900 mb-3">Assembleias</h3>
            <div className="space-y-2 max-h-[420px] overflow-auto pr-2">
              {loading && <LoadingSpinner message="Carregando..." />}
              {!loading && assembleias.length === 0 && <div className="text-sm text-gray-500">Nenhuma assembleia encontrada.</div>}
              {assembleias.map(a => (
                <button key={a.id} onClick={()=>setSelected(a)} className={`w-full text-left px-3 py-2 rounded-lg border ${selected?.id===a.id?'border-purple-400 bg-purple-50':'border-gray-200 hover:bg-gray-50'}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{a.titulo}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full border" title={a.status}>
                      {a.status === 'agendada' && '📅'}
                      {a.status === 'em_andamento' && '🟢'}
                      {a.status === 'encerrada' && '✅'}
                      {a.status === 'cancelada' && '❌'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600">{new Date(a.data_hora).toLocaleString('pt-BR')}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Coluna direita: detalhes e gestão */}
        <div className="lg:col-span-2">
          {!selected && (
            <div className="h-full min-h-[480px] border-2 border-dashed rounded-xl flex items-center justify-center text-gray-500">Selecione uma assembleia à esquerda para gerenciar.</div>
          )}

          {selected && (
            <div className="space-y-6">
              <div className="bg-white border border-gray-200 rounded-xl p-4" data-testid="qr-presenca-section">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-gray-900">Editar Assembleia</h3>
                  <div className="flex gap-2">
                    {selected.status === 'agendada' && (
                      <button onClick={()=>setStatusAssembleia(selected.id, 'em_andamento')} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-bold" data-testid="btn-iniciar-assembleia">Iniciar</button>
                    )}
                    {selected.status !== 'encerrada' && selected.status !== 'cancelada' && (
                      <button onClick={()=>setStatusAssembleia(selected.id, 'encerrada')} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-bold" data-testid="btn-encerrar-assembleia">Encerrar</button>
                    )}
                    {selected.status !== 'cancelada' && (
                      <button onClick={()=>setStatusAssembleia(selected.id, 'cancelada')} className="px-3 py-1.5 bg-gray-600 text-white rounded-lg text-sm font-bold" data-testid="btn-cancelar-assembleia">Cancelar</button>
                    )}
                    <button onClick={()=>{ if(confirm('Excluir assembleia?')) deleteAssembleia(selected.id).then(()=>setSelected(null)) }} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-bold" data-testid="btn-excluir-assembleia">Excluir</button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input className="border rounded-lg px-3 py-2" value={editAss.titulo} onChange={e=>setEditAss(s=>({...s, titulo:e.target.value}))} />
                  <input className="border rounded-lg px-3 py-2" type="datetime-local" value={editAss.data_hora} onChange={e=>setEditAss(s=>({...s, data_hora:e.target.value}))} />
                  <div className="md:col-span-1">
                    <label className="text-xs text-gray-500">Edital (tópicos)</label>
                    <textarea className="w-full border rounded-lg px-3 py-2" rows={4} value={editAss.edital_topicos_text} onChange={e=>setEditAss(s=>({...s, edital_topicos_text:e.target.value}))} />
                    <input className="w-full mt-2" type="file" accept="application/pdf" onChange={e=>setEditAss(s=>({...s, edital_pdf_file: e.target.files?.[0] || null}))} />
                  </div>
                  <div className="md:col-span-1">
                    <label className="text-xs text-gray-500">Ata (tópicos)</label>
                    <textarea className="w-full border rounded-lg px-3 py-2" rows={4} value={editAss.ata_topicos_text} onChange={e=>setEditAss(s=>({...s, ata_topicos_text:e.target.value}))} />
                    <input className="w-full mt-2" type="file" accept="application/pdf" onChange={e=>setEditAss(s=>({...s, ata_pdf_file: e.target.files?.[0] || null}))} />
                  </div>
                </div>
                <div className="mt-3">
                  <button onClick={handleUpdate} className="px-4 py-2 bg-purple-600 text-white rounded-lg font-bold">Salvar Alterações</button>
                </div>
              </div>

              {/* QR de Presença */}
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-gray-900">QR de Presença</h3>
                  <div className="text-xs font-bold px-2 py-1 rounded bg-gray-100 text-gray-700 border">Somente durante a assembleia</div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                  <div className="md:col-span-1 flex items-center justify-center">
                    <div className="p-3 bg-white border rounded-xl">
                      <QRCodeCanvas value={`${window.location.origin}/transparencia/assembleias/${selected.id}/presenca`} size={180} includeMargin={true} />
                    </div>
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <div className="text-sm text-gray-700 break-all">
                      <span className="font-bold text-gray-900">Link:</span>{' '}
                      {`${window.location.origin}/transparencia/assembleias/${selected.id}/presenca`}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => navigator.clipboard.writeText(`${window.location.origin}/transparencia/assembleias/${selected.id}/presenca`) }
                        className="px-3 py-2 bg-gray-800 text-white rounded-lg text-sm font-bold"
                      >
                        Copiar Link
                      </button>
                      <a
                        href={`/transparencia/assembleias/${selected.id}/presenca`}
                        target="_blank"
                        className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold"
                      >
                        Abrir em Nova Aba
                      </a>
                    </div>
                    <p className="text-xs text-gray-500">Peça para os moradores escanearem o QR durante a assembleia para registrar presença automaticamente.</p>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-gray-900">Pautas de Votação</h3>
                  <div className="text-sm text-gray-500">Total: {pautas.length}</div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <input className="border rounded-lg px-3 py-2 md:col-span-2" placeholder="Título da pauta" value={pautaForm.titulo} onChange={e=>setPautaForm(s=>({...s, titulo:e.target.value}))} />
                  <input className="border rounded-lg px-3 py-2" placeholder="Ordem" type="number" min={1} value={pautaForm.ordem} onChange={e=>setPautaForm(s=>({...s, ordem: Number(e.target.value)}))} />
                  <select className="border rounded-lg px-3 py-2" value={pautaForm.tipo_votacao} onChange={e=>setPautaForm(s=>({...s, tipo_votacao: e.target.value as any}))}>
                    <option value="aberta">Votação Aberta</option>
                    <option value="secreta">Votação Secreta</option>
                  </select>
                  <textarea className="md:col-span-3 border rounded-lg px-3 py-2" rows={3} placeholder="Descrição (opcional)" value={pautaForm.descricao} onChange={e=>setPautaForm(s=>({...s, descricao:e.target.value}))} />
                  <textarea className="md:col-span-3 border rounded-lg px-3 py-2" rows={3} placeholder="Opções (1 por linha)" value={pautaForm.opcoes_text} onChange={e=>setPautaForm(s=>({...s, opcoes_text:e.target.value}))} />
                  <button onClick={handleAddPauta} className="md:col-span-1 px-4 py-2 bg-green-600 text-white rounded-lg font-bold">Adicionar Pauta</button>
                </div>

                <div className="mt-4 divide-y">
                  {pautas.map((p) => (
                    <div key={p.id} className="py-3 flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900">{p.ordem}. {p.titulo}</div>
                        <div className="text-xs text-gray-600">{p.tipo_votacao === 'aberta' ? 'Votação aberta' : 'Votação secreta'} • {p.opcoes.join(', ')}</div>
                      </div>
                      <div className="flex gap-2">
                        {p.status === 'pendente' && (
                          <button onClick={()=>abrirVotacao(p.id).then(()=>loadPautas(selected.id).then(setPautas))} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-bold" data-testid="btn-abrir-votacao">Abrir Votação</button>
                        )}
                        {p.status === 'em_votacao' && (
                          <button onClick={()=>encerrarVotacao(p.id).then(()=>loadPautas(selected.id).then(setPautas))} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-bold" data-testid="btn-encerrar-votacao">Encerrar</button>
                        )}
                        <button onClick={()=>{ if(confirm('Excluir pauta?')) deletePauta(p.id).then(()=>loadPautas(selected.id).then(setPautas)) }} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-bold" data-testid="btn-excluir-pauta">Excluir</button>
                      </div>
                    </div>
                  ))}
                  {pautas.length === 0 && (
                    <div className="text-sm text-gray-500">Nenhuma pauta cadastrada.</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  )
}

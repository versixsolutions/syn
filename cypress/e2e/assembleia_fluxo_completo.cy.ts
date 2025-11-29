/// <reference types="cypress" />

describe('Fluxo Completo de Assembleias', () => {
  const adminEmail = 'admin@test.com'
  const adminPassword = 'test123'
  const moradorEmail = 'morador@test.com'
  const moradorPassword = 'test123'

  let assembleiaId: string
  let linkPresenca: string

  before(() => {
    // Limpar localStorage
    cy.clearLocalStorage()
    cy.clearCookies()
  })

  describe('Como ADMIN/SÍNDICO - Criação e Gestão', () => {
    it('Deve fazer login como admin', () => {
      cy.visit('/login')
      cy.get('input[type="email"]').type(adminEmail)
      cy.get('input[type="password"]').type(adminPassword)
      cy.get('button[type="submit"]').click()
      
      // Aguardar redirect para dashboard
      cy.url().should('include', '/dashboard')
      cy.contains('Dashboard').should('be.visible')
    })

    it('Deve acessar gestão de assembleias', () => {
      cy.visit('/admin/assembleias')
      cy.contains('Gestão de Assembleias').should('be.visible')
    })

    it('Deve criar nova assembleia', () => {
      cy.get('input[name="titulo"]').type('Assembleia de Teste E2E')
      
      // Data futura (amanhã às 19:00)
      const amanha = new Date()
      amanha.setDate(amanha.getDate() + 1)
      const dataFormatada = amanha.toISOString().slice(0, 16)
      cy.get('input[type="datetime-local"]').type(dataFormatada)
      
      // Tópicos do edital
      cy.get('textarea[placeholder*="edital"]').type(
        'Tópico 1: Teste automatizado\nTópico 2: Cypress E2E\nTópico 3: Validação completa'
      )
      
      // Criar
      cy.contains('button', 'Criar Assembleia').click()
      
      // Aguardar toast de sucesso
      cy.contains('Assembleia criada').should('be.visible')
      
      // Aguardar assembleia aparecer na lista
      cy.contains('Assembleia de Teste E2E').should('be.visible')
    })

    it('Deve adicionar pautas de votação', () => {
      // Selecionar assembleia criada
      cy.contains('Assembleia de Teste E2E').click()
      
      // Adicionar primeira pauta
      cy.get('input[name="pauta_titulo"]').type('Aprovar novo regulamento')
      cy.get('textarea[name="pauta_descricao"]').type(
        'Proposta de atualização do regulamento interno com novas regras de uso de áreas comuns.'
      )
      cy.contains('button', 'Adicionar Pauta').click()
      cy.contains('Pauta adicionada').should('be.visible')
      
      // Adicionar segunda pauta
      cy.get('input[name="pauta_titulo"]').type('Autorizar reforma da piscina')
      cy.get('textarea[name="pauta_descricao"]').type(
        'Autorização para reforma e modernização da piscina com orçamento de R$ 50.000'
      )
      cy.contains('button', 'Adicionar Pauta').click()
      cy.contains('Pauta adicionada').should('be.visible')
      
      // Verificar que pautas aparecem
      cy.contains('Aprovar novo regulamento').should('be.visible')
      cy.contains('Autorizar reforma da piscina').should('be.visible')
    })

    it('Deve iniciar assembleia', () => {
      // Botão de iniciar assembleia
      cy.get('[data-testid="btn-iniciar-assembleia"]').click()
      
      // Aguardar toast
      cy.contains('Assembleia iniciada').should('be.visible')
      
      // Status deve mudar
      cy.contains('Em Andamento').should('be.visible')
    })

    it('Deve exibir QR code de presença', () => {
      // Seção de QR deve estar visível
      cy.get('[data-testid="qr-presenca-section"]').should('be.visible')
      
      // QR code canvas
      cy.get('canvas').should('exist')
      
      // Link de presença
      cy.get('[data-testid="btn-copiar-link"]').should('be.visible')
      
      // Capturar link para usar depois
      cy.get('input[readonly]').invoke('val').then((val) => {
        linkPresenca = val as string
        cy.log('Link de presença:', linkPresenca)
      })
    })

    it('Deve abrir votação da primeira pauta', () => {
      // Localizar primeira pauta
      cy.contains('Aprovar novo regulamento').parents('.pauta-card').within(() => {
        cy.get('[data-testid="btn-abrir-votacao"]').click()
      })
      
      // Aguardar toast
      cy.contains('Votação aberta').should('be.visible')
      
      // Status deve mudar
      cy.contains('Aprovar novo regulamento').parents('.pauta-card').within(() => {
        cy.contains('Em Votação').should('be.visible')
      })
    })

    it('Deve fazer logout', () => {
      cy.get('button[aria-label="Menu do usuário"]').click()
      cy.contains('Sair').click()
      cy.url().should('include', '/login')
    })
  })

  describe('Como MORADOR - Presença e Votação', () => {
    it('Deve fazer login como morador', () => {
      cy.visit('/login')
      cy.get('input[type="email"]').type(moradorEmail)
      cy.get('input[type="password"]').type(moradorPassword)
      cy.get('button[type="submit"]').click()
      
      cy.url().should('include', '/dashboard')
    })

    it('Deve registrar presença via link', () => {
      // Acessar link de presença (extraído do teste anterior)
      cy.visit(linkPresenca || '/transparencia/assembleias')
      
      // Aguardar página de presença
      cy.get('[data-testid="presenca-page"]').should('be.visible')
      
      // Status de sucesso
      cy.get('[data-testid="presenca-status"]').should('contain', 'registrada')
    })

    it('Deve acessar detalhes da assembleia', () => {
      // Voltar para listagem
      cy.get('[data-testid="presenca-voltar"]').click()
      
      // Deve estar na página de detalhes
      cy.contains('Assembleia de Teste E2E').should('be.visible')
      cy.contains('Edital').should('be.visible')
    })

    it('Deve votar na pauta aberta', () => {
      // Localizar seção de votações abertas
      cy.contains('Votações Abertas').should('be.visible')
      cy.contains('Aprovar novo regulamento').should('be.visible')
      
      // Selecionar opção "Sim"
      cy.contains('Aprovar novo regulamento').parents('.pauta-votacao').within(() => {
        cy.get('input[value="Sim"]').check()
        cy.contains('button', 'Confirmar Voto').click()
      })
      
      // Aguardar confirmação
      cy.contains('Voto registrado').should('be.visible')
    })

    it('Não deve permitir votar novamente', () => {
      // Tentar votar de novo
      cy.contains('Aprovar novo regulamento').parents('.pauta-votacao').within(() => {
        cy.get('input[value="Não"]').check()
        cy.contains('button', 'Confirmar Voto').click()
      })
      
      // Deve mostrar erro
      cy.contains('Você já votou').should('be.visible')
    })

    it('Deve ver resultados parciais em tempo real', () => {
      // Resultados devem estar visíveis
      cy.contains('Resultados Parciais').should('be.visible')
      
      // Deve ter pelo menos 1 voto (o nosso)
      cy.contains(/1.*voto/i).should('be.visible')
      
      // Percentual deve aparecer
      cy.contains(/\d+%/).should('be.visible')
    })

    it('Deve fazer logout', () => {
      cy.get('button[aria-label="Menu do usuário"]').click()
      cy.contains('Sair').click()
    })
  })

  describe('Como ADMIN - Encerramento e Resultados', () => {
    it('Deve fazer login novamente como admin', () => {
      cy.visit('/login')
      cy.get('input[type="email"]').type(adminEmail)
      cy.get('input[type="password"]').type(adminPassword)
      cy.get('button[type="submit"]').click()
      cy.url().should('include', '/dashboard')
    })

    it('Deve encerrar votação da pauta', () => {
      cy.visit('/admin/assembleias')
      cy.contains('Assembleia de Teste E2E').click()
      
      // Encerrar votação
      cy.contains('Aprovar novo regulamento').parents('.pauta-card').within(() => {
        cy.get('[data-testid="btn-encerrar-votacao"]').click()
      })
      
      // Confirmar
      cy.contains('Votação encerrada').should('be.visible')
      
      // Status deve mudar
      cy.contains('Aprovar novo regulamento').parents('.pauta-card').within(() => {
        cy.contains('Encerrada').should('be.visible')
      })
    })

    it('Deve encerrar assembleia', () => {
      cy.get('[data-testid="btn-encerrar-assembleia"]').click()
      cy.contains('Assembleia encerrada').should('be.visible')
      cy.contains('Status: Encerrada').should('be.visible')
    })

    it('Deve visualizar resultados finais como morador', () => {
      // Logout
      cy.get('button[aria-label="Menu do usuário"]').click()
      cy.contains('Sair').click()
      
      // Login como morador
      cy.get('input[type="email"]').type(moradorEmail)
      cy.get('input[type="password"]').type(moradorPassword)
      cy.get('button[type="submit"]').click()
      
      // Acessar assembleia
      cy.visit('/transparencia/assembleias')
      cy.contains('Assembleia de Teste E2E').click()
      
      // Resultados finais devem estar visíveis
      cy.contains('Resultados Finais').should('be.visible')
      cy.contains('Aprovar novo regulamento').should('be.visible')
      
      // Deve ter botão de export PDF
      cy.contains('Exportar Resultados').should('be.visible')
    })

    it('Deve exportar PDF de resultados', () => {
      cy.contains('button', 'Exportar Resultados (PDF)').click()
      
      // Aguardar download (Cypress pode interceptar)
      // Em teste real, verificaria que arquivo foi baixado
      cy.wait(1000)
      
      // Toast de sucesso
      cy.contains('PDF gerado').should('be.visible')
    })
  })

  describe('Limpeza - Excluir assembleia de teste', () => {
    it('Deve fazer login como admin', () => {
      cy.visit('/login')
      cy.get('input[type="email"]').type(adminEmail)
      cy.get('input[type="password"]').type(adminPassword)
      cy.get('button[type="submit"]').click()
    })

    it('Deve excluir assembleia de teste', () => {
      cy.visit('/admin/assembleias')
      cy.contains('Assembleia de Teste E2E').click()
      
      // Botão de excluir
      cy.get('[data-testid="btn-excluir-assembleia"]').click()
      
      // Confirmar no modal
      cy.contains('Confirmar exclusão').should('be.visible')
      cy.contains('button', 'Sim, excluir').click()
      
      // Aguardar confirmação
      cy.contains('Assembleia excluída').should('be.visible')
      
      // Assembleia não deve mais aparecer
      cy.contains('Assembleia de Teste E2E').should('not.exist')
    })
  })
})

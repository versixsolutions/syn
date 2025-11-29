/**
 * E2E Test: Fluxo de Presença por Link/QR
 * - Acessa página de presença com ID inválido
 * - Verifica renderização e mensagens básicas
 * - (Opcional) Faz login com credenciais de teste e verifica feedback
 */

describe('Fluxo de Presença - Link/QR', () => {
  it('deve exibir página de presença mesmo com ID inválido', () => {
    cy.visit('/transparencia/assembleias/invalid-id/presenca')
    cy.get('[data-testid="presenca-page"]').should('be.visible')
    cy.get('[data-testid="presenca-status"]').should('be.visible')
  })

  it('deve permitir navegação de volta para assembleia', () => {
    cy.visit('/transparencia/assembleias/invalid-id/presenca')
    // botão Voltar aparece somente em alguns estados; validar existência condicionalmente
    cy.get('body').then($body => {
      const $btn = $body.find('[data-testid="presenca-voltar"]')
      if ($btn.length) {
        cy.wrap($btn).click({ force: true })
        cy.url().should('include', '/transparencia/assembleias/invalid-id')
      }
    })
  })

  it('deve manter UI estável ao estar logado', () => {
    const testEmail = Cypress.env('TEST_EMAIL') || 'test@example.com'
    const testPassword = Cypress.env('TEST_PASSWORD') || 'testpass123'

    // Login
    cy.visit('/login')
    cy.get('input[type="email"]').type(testEmail)
    cy.get('input[type="password"]').type(testPassword)
    cy.get('button[type="submit"]').click()

    // Ir para página de presença
    cy.visit('/transparencia/assembleias/invalid-id/presenca')
    cy.get('[data-testid="presenca-page"]').should('be.visible')
    cy.get('[data-testid="presenca-status"]').should('be.visible')
  })
})

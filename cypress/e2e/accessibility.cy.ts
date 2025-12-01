describe('Accessibility Tests', () => {
  beforeEach(() => {
    // requer suporte ao cypress-axe em support/e2e
    cy.injectAxe()
  })

  it('Dashboard deve passar verificação de acessibilidade', () => {
    cy.login('morador@test.com', 'password123')
    cy.visit('/dashboard')
    cy.checkA11y(null, {
      rules: {
        'color-contrast': { enabled: true },
        label: { enabled: true },
        'button-name': { enabled: true },
      },
    })
  })

  it('Login deve ter labels acessíveis', () => {
    cy.visit('/login')
    cy.checkA11y()
  })

  it('Chatbot deve ser navegável por teclado', () => {
    cy.login('morador@test.com', 'password123')
    cy.visit('/dashboard')

    cy.get('body').tab()
    cy.focused().should('have.attr', 'data-testid', 'chatbot-fab')

    cy.focused().type('{enter}')
    cy.get('[role="dialog"]').should('be.visible')

    cy.focused().tab()
    cy.focused().should('have.attr', 'data-testid', 'chat-input')

    cy.get('body').type('{esc}')
    cy.get('[role="dialog"]').should('not.exist')
  })
})

describe('Chatbot Integration', () => {
  beforeEach(() => {
    // Assumindo que há um comando customizado cy.login já configurado
    cy.login('morador@test.com', 'password123')
    cy.visit('/dashboard')
  })

  it('deve abrir o chatbot ao clicar no FAB', () => {
    cy.get('[data-testid="chatbot-fab"]').click()
    cy.get('[role="dialog"]').should('be.visible')
    cy.contains('Olá').should('be.visible')
  })

  it('deve enviar mensagem e receber resposta', () => {
    cy.get('[data-testid="chatbot-fab"]').click()

    cy.get('[data-testid="chat-input"]').type('Qual o horário da piscina?')
    cy.get('[data-testid="chat-submit"]').click()

    cy.get('[data-testid="chat-message-assistant"]', { timeout: 15000 }).should(
      'have.length.greaterThan',
      1,
    )
  })

  it('deve mostrar indicador de typing durante a requisição', () => {
    cy.get('[data-testid="chatbot-fab"]').click()

    cy.intercept('POST', '**/ask-ai', {
      delay: 2000,
      body: { answer: 'Resposta teste', sources: [] },
    }).as('askAi')

    cy.get('[data-testid="chat-input"]').type('Teste')
    cy.get('[data-testid="chat-submit"]').click()

    cy.get('[data-testid="typing-indicator"]').should('be.visible')

    cy.wait('@askAi')
    cy.get('[data-testid="typing-indicator"]').should('not.exist')
  })

  it('deve tratar erro de rate limit graciosamente', () => {
    cy.get('[data-testid="chatbot-fab"]').click()

    cy.intercept('POST', '**/ask-ai', {
      statusCode: 429,
      body: { answer: 'Limite atingido' },
    }).as('rateLimited')

    cy.get('[data-testid="chat-input"]').type('Teste')
    cy.get('[data-testid="chat-submit"]').click()

    cy.wait('@rateLimited')
    cy.contains('Limite').should('be.visible')
  })
})

describe('Performance Tests', () => {
  it('Dashboard deve carregar em menos de 3 segundos', () => {
    cy.login('morador@test.com', 'password123')

    const start = performance.now()
    cy.visit('/dashboard')
    cy.get('[data-testid="dashboard-loaded"]').should('exist')

    cy.then(() => {
      const loadTime = performance.now() - start
      expect(loadTime).to.be.lessThan(3000)
    })
  })

  it('Chatbot deve responder em menos de 10 segundos', () => {
    cy.login('morador@test.com', 'password123')
    cy.visit('/dashboard')

    cy.get('[data-testid="chatbot-fab"]').click()

    const start = performance.now()

    cy.get('[data-testid="chat-input"]').type('Teste de performance')
    cy.get('[data-testid="chat-submit"]').click()

    cy.get('[data-testid="chat-message-assistant"]', { timeout: 15000 }).should(
      'have.length.greaterThan',
      1,
    )

    cy.then(() => {
      const responseTime = performance.now() - start
      expect(responseTime).to.be.lessThan(10000)
    })
  })
})
